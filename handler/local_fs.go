package handler

import (
	"os"
	"path/filepath"
	"sort"
	"strings"

	"golang.org/x/net/websocket"
)

type LocalFileInfo struct {
	Name    string `json:"name"`
	Path    string `json:"path"`
	Size    int64  `json:"size"`
	Mode    uint32 `json:"mode"`
	ModTime string `json:"mod_time"`
	IsDir   bool   `json:"is_dir"`
	IsLink  bool   `json:"is_link"`
}

func HandleLocalFS(conn *websocket.Conn) {
	var msg struct {
		Action  string `json:"action"`
		Path    string `json:"path"`
		Content string `json:"content"`
		NewPath string `json:"new_path"`
	}

	for {
		if err := websocket.JSON.Receive(conn, &msg); err != nil {
			return
		}
		switch msg.Action {
		case "getwd":
			wd, err := os.Getwd()
			if err != nil {
				websocket.JSON.Send(conn, map[string]interface{}{"type": "error", "error": err.Error()})
			} else {
				websocket.JSON.Send(conn, map[string]interface{}{"type": "pwd", "path": wd})
			}
		case "list":
			path := msg.Path
			if path == "" {
				path = "/"
			}
			entries, err := os.ReadDir(path)
			if err != nil {
				websocket.JSON.Send(conn, map[string]interface{}{"type": "error", "error": err.Error()})
				continue
			}
			var files []LocalFileInfo
			for _, e := range entries {
				info, err := e.Info()
				if err != nil {
					continue
				}
				fullPath := filepath.Join(path, e.Name())
				f := LocalFileInfo{
					Name:    e.Name(),
					Path:    fullPath,
					Size:    info.Size(),
					Mode:    uint32(info.Mode()),
					ModTime: info.ModTime().Format("2006-01-02 15:04:05"),
					IsDir:   e.IsDir(),
					IsLink:  info.Mode()&os.ModeSymlink != 0,
				}
				files = append(files, f)
			}
			sort.Slice(files, func(i, j int) bool {
				if files[i].IsDir != files[j].IsDir {
					return files[i].IsDir
				}
				return strings.ToLower(files[i].Name) < strings.ToLower(files[j].Name)
			})
			websocket.JSON.Send(conn, map[string]interface{}{
				"type":  "file_list",
				"path":  path,
				"files": files,
			})
		case "read":
			data, err := os.ReadFile(msg.Path)
			if err != nil {
				websocket.JSON.Send(conn, map[string]interface{}{"type": "error", "error": err.Error()})
			} else {
				websocket.JSON.Send(conn, map[string]interface{}{
					"type":    "file_content",
					"path":    msg.Path,
					"content": string(data),
				})
			}
		case "write":
			err := os.WriteFile(msg.Path, []byte(msg.Content), 0644)
			if err != nil {
				websocket.JSON.Send(conn, map[string]interface{}{"type": "error", "error": err.Error()})
			} else {
				websocket.JSON.Send(conn, map[string]interface{}{"type": "write_done", "path": msg.Path})
			}
		case "delete":
			err := os.Remove(msg.Path)
			if err != nil {
				websocket.JSON.Send(conn, map[string]interface{}{"type": "error", "error": err.Error()})
			} else {
				websocket.JSON.Send(conn, map[string]interface{}{"type": "delete_done", "path": msg.Path})
			}
		case "mkdir":
			err := os.MkdirAll(msg.Path, 0755)
			if err != nil {
				websocket.JSON.Send(conn, map[string]interface{}{"type": "error", "error": err.Error()})
			} else {
				websocket.JSON.Send(conn, map[string]interface{}{"type": "mkdir_done", "path": msg.Path})
			}
		case "rename":
			err := os.Rename(msg.Path, msg.NewPath)
			if err != nil {
				websocket.JSON.Send(conn, map[string]interface{}{"type": "error", "error": err.Error()})
			} else {
				websocket.JSON.Send(conn, map[string]interface{}{"type": "rename_done", "path": msg.Path, "new_path": msg.NewPath})
			}
		}
	}
}
