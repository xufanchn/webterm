package sshmgr

import "sync"

type poolEntry struct {
	client   *Client
	refCount int
}

type Pool struct {
	mu      sync.Mutex
	entries map[int64]*poolEntry
}

func NewPool() *Pool {
	return &Pool{entries: make(map[int64]*poolEntry)}
}

// Acquire returns an existing client and increments its ref count.
// Does NOT probe liveness (keepalive) to avoid false-positive disconnects.
func (p *Pool) Acquire(connID int64) (*Client, bool) {
	p.mu.Lock()
	defer p.mu.Unlock()
	e, ok := p.entries[connID]
	if ok && e.client.RawConn() != nil {
		e.refCount++
		return e.client, true
	}
	return nil, false
}

// Add inserts a new client with ref count 1.
func (p *Pool) Add(connID int64, c *Client) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.entries[connID] = &poolEntry{client: c, refCount: 1}
}

// AcquireOrCreate atomically acquires an existing client or creates a new one.
// The factory is called outside the lock to avoid blocking other connection IDs.
func (p *Pool) AcquireOrCreate(connID int64, factory func() (*Client, error)) (*Client, error) {
	p.mu.Lock()
	e, ok := p.entries[connID]
	if ok && e.client.RawConn() != nil {
		e.refCount++
		p.mu.Unlock()
		return e.client, nil
	}
	if ok {
		delete(p.entries, connID)
	}
	p.mu.Unlock()

	client, err := factory()
	if err != nil {
		return nil, err
	}

	p.mu.Lock()
	// Double-check: another goroutine might have created one while we were connecting
	e, ok = p.entries[connID]
	if ok && e.client.RawConn() != nil {
		client.Close()
		e.refCount++
		p.mu.Unlock()
		return e.client, nil
	}
	p.entries[connID] = &poolEntry{client: client, refCount: 1}
	p.mu.Unlock()
	return client, nil
}
// SessionCount returns the current number of active sessions (ref count) for a connId.
func (p *Pool) SessionCount(connID int64) int {
	p.mu.Lock()
	defer p.mu.Unlock()
	e, ok := p.entries[connID]
	if !ok {
		return 0
	}
	return e.refCount
}

// Remove deletes the pool entry without closing the client (used on credential update).
// Active sessions keep using the old connection; new sessions will re-authenticate.
func (p *Pool) Remove(connID int64) {
	p.mu.Lock()
	defer p.mu.Unlock()
	delete(p.entries, connID)
}

func (p *Pool) Release(connID int64) {
	p.mu.Lock()
	defer p.mu.Unlock()
	e, ok := p.entries[connID]
	if !ok {
		return
	}
	e.refCount--
	if e.refCount <= 0 {
		e.client.Close()
		delete(p.entries, connID)
	}
}
