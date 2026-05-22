package sshmgr

import "sync"

type Pool struct {
	mu      sync.RWMutex
	clients map[int64]*Client
}

func NewPool() *Pool {
	return &Pool{clients: make(map[int64]*Client)}
}

func (p *Pool) Get(connID int64) (*Client, bool) {
	p.mu.RLock()
	defer p.mu.RUnlock()
	c, ok := p.clients[connID]
	return c, ok
}

func (p *Pool) Set(connID int64, c *Client) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.clients[connID] = c
}

func (p *Pool) Remove(connID int64) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if c, ok := p.clients[connID]; ok {
		c.Close()
		delete(p.clients, connID)
	}
}
