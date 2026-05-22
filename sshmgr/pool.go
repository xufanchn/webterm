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

// Acquire returns an existing alive client and increments its ref count.
func (p *Pool) Acquire(connID int64) (*Client, bool) {
	p.mu.Lock()
	defer p.mu.Unlock()
	e, ok := p.entries[connID]
	if ok && e.client.IsAlive() {
		e.refCount++
		return e.client, true
	}
	if ok {
		e.client.Close()
		delete(p.entries, connID)
	}
	return nil, false
}

// Add inserts a new client with ref count 1.
func (p *Pool) Add(connID int64, c *Client) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.entries[connID] = &poolEntry{client: c, refCount: 1}
}

// Release decrements the ref count and removes the client when it reaches zero.
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
