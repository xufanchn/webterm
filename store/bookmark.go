package store

import "time"

type SftpBookmark struct {
	ID           int64     `json:"id"`
	GroupID      int64     `json:"group_id"`
	ConnectionID int64     `json:"connection_id"`
	Name         string    `json:"name"`
	RemotePath   string    `json:"remote_path"`
	CreatedAt    time.Time `json:"created_at"`
}

func (s *Store) ListBookmarks() ([]SftpBookmark, error) {
	rows, err := s.DB.Query("SELECT id, group_id, connection_id, name, remote_path, created_at FROM sftp_bookmarks ORDER BY name")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var bm []SftpBookmark
	for rows.Next() {
		var b SftpBookmark
		if err := rows.Scan(&b.ID, &b.GroupID, &b.ConnectionID, &b.Name, &b.RemotePath, &b.CreatedAt); err != nil {
			return nil, err
		}
		bm = append(bm, b)
	}
	return bm, nil
}

func (s *Store) CreateBookmark(b *SftpBookmark) (int64, error) {
	res, err := s.DB.Exec(
		"INSERT INTO sftp_bookmarks (group_id, connection_id, name, remote_path) VALUES (?, ?, ?, ?)",
		b.GroupID, b.ConnectionID, b.Name, b.RemotePath,
	)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func (s *Store) DeleteBookmark(id int64) error {
	_, err := s.DB.Exec("DELETE FROM sftp_bookmarks WHERE id=?", id)
	return err
}
