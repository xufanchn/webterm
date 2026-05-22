package sshmgr

import (
	"fmt"
	"net"
	"time"

	"golang.org/x/crypto/ssh"
)

type Client struct {
	conn   *ssh.Client
	config *ssh.ClientConfig
	addr   string
}

func NewClient(host string, port int, username, password, privateKey, passphrase string) (*Client, error) {
	authMethods := []ssh.AuthMethod{}
	if password != "" {
		authMethods = append(authMethods, ssh.Password(password))
	}
	if privateKey != "" {
		var signer ssh.Signer
		var err error
		if passphrase != "" {
			signer, err = ssh.ParsePrivateKeyWithPassphrase([]byte(privateKey), []byte(passphrase))
		} else {
			signer, err = ssh.ParsePrivateKey([]byte(privateKey))
		}
		if err != nil {
			return nil, err
		}
		authMethods = append(authMethods, ssh.PublicKeys(signer))
	}
	config := &ssh.ClientConfig{
		User:            username,
		Auth:            authMethods,
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		Timeout:         10 * time.Second,
	}
	return &Client{
		config: config,
		addr:   net.JoinHostPort(host, fmt.Sprintf("%d", port)),
	}, nil
}

func (c *Client) Connect() error {
	conn, err := ssh.Dial("tcp", c.addr, c.config)
	if err != nil {
		return err
	}
	c.conn = conn
	return nil
}

func (c *Client) NewSession() (*ssh.Session, error) {
	return c.conn.NewSession()
}

func (c *Client) IsAlive() bool {
	if c.conn == nil {
		return false
	}
	_, _, err := c.conn.SendRequest("keepalive@openssh.com", true, nil)
	return err == nil
}

func (c *Client) RawConn() *ssh.Client {
	return c.conn
}

func (c *Client) Close() error {
	if c.conn != nil {
		return c.conn.Close()
	}
	return nil
}
