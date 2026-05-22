package sftpmgr

import (
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"sort"

	"github.com/pkg/sftp"
	"golang.org/x/crypto/ssh"
)

type Client struct {
	conn   *sftp.Client
	sshCli *ssh.Client
}

func NewClient(sshClient *ssh.Client) (*Client, error) {
	sftpClient, err := sftp.NewClient(sshClient)
	if err != nil {
		return nil, err
	}
	return &Client{conn: sftpClient, sshCli: sshClient}, nil
}

type FileInfo struct {
	Name    string      `json:"name"`
	Path    string      `json:"path"`
	Size    int64       `json:"size"`
	Mode    os.FileMode `json:"mode"`
	ModTime string      `json:"mod_time"`
	IsDir   bool        `json:"is_dir"`
	IsLink  bool        `json:"is_link"`
	LinkTo  string      `json:"link_to,omitempty"`
}

func (c *Client) ListDir(path string) ([]FileInfo, error) {
	if path == "" {
		path = "."
	}
	files, err := c.conn.ReadDir(path)
	if err != nil {
		return nil, err
	}
	sort.Slice(files, func(i, j int) bool {
		if files[i].IsDir() != files[j].IsDir() {
			return files[i].IsDir()
		}
		return files[i].Name() < files[j].Name()
	})
	var result []FileInfo
	for _, f := range files {
		info := FileInfo{
			Name:    f.Name(),
			Path:    filepath.Join(path, f.Name()),
			Size:    f.Size(),
			Mode:    f.Mode(),
			ModTime: f.ModTime().Format("2006-01-02 15:04:05"),
			IsDir:   f.IsDir(),
		}
		if f.Mode()&os.ModeSymlink != 0 {
			info.IsLink = true
			if link, err := c.conn.ReadLink(info.Path); err == nil {
				info.LinkTo = link
			}
		}
		result = append(result, info)
	}
	return result, nil
}

func (c *Client) ReadFile(path string) ([]byte, error) {
	f, err := c.conn.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	return io.ReadAll(f)
}

func (c *Client) WriteFile(path string, content []byte) error {
	f, err := c.conn.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()
	_, err = f.Write(content)
	return err
}

func (c *Client) WriteFileFromReader(path string, reader io.Reader) error {
	f, err := c.conn.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()
	_, err = io.Copy(f, reader)
	return err
}

func (c *Client) Delete(path string) error {
	return c.conn.Remove(path)
}

func (c *Client) Rename(oldPath, newPath string) error {
	return c.conn.Rename(oldPath, newPath)
}

func (c *Client) Mkdir(path string) error {
	return c.conn.Mkdir(path)
}

func (c *Client) Chmod(path string, mode fs.FileMode) error {
	return c.conn.Chmod(path, mode)
}

func (c *Client) Getwd() (string, error) {
	return c.conn.Getwd()
}

func (c *Client) Close() error {
	return c.conn.Close()
}
