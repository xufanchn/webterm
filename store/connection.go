package store

import (
	"database/sql"
	"time"
)

type Connection struct {
	ID                            int64     `json:"id"`
	GroupID                       int64     `json:"group_id"`
	Name                          string    `json:"name"`
	Host                          string    `json:"host"`
	Port                          int       `json:"port"`
	Username                      string    `json:"username"`
	AuthMethod                    string    `json:"auth_method"`
	PasswordEncrypted             string    `json:"-"`
	Password                      string    `json:"password,omitempty"`
	PrivateKeyEncrypted           string    `json:"-"`
	PrivateKeyPassphraseEncrypted string    `json:"-"`
	CreatedBy                     int64     `json:"created_by"`
	Shared                        bool      `json:"shared"`
	MaxSessions                   int       `json:"max_sessions"`
	Tag                           string    `json:"tag"`
	Color                         string    `json:"color"`
	CreatedAt                     time.Time `json:"created_at"`
	UpdatedAt                     time.Time `json:"updated_at"`
}

func (s *Store) ListConnections(groupID int64, userID int64) ([]Connection, error) {
	var rows *sql.Rows
	var err error
	cols := "SELECT id, group_id, name, host, port, username, auth_method, password_encrypted, private_key_encrypted, private_key_passphrase_encrypted, created_by, shared, max_sessions, tag, color, created_at, updated_at FROM connections WHERE (created_by=? OR shared=1)"
	if groupID > 0 {
		rows, err = s.DB.Query(cols+" AND group_id=? ORDER BY name", userID, groupID)
	} else {
		rows, err = s.DB.Query(cols+" ORDER BY name", userID)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	conns := make([]Connection, 0)
	for rows.Next() {
		var c Connection
		if err := rows.Scan(&c.ID, &c.GroupID, &c.Name, &c.Host, &c.Port, &c.Username, &c.AuthMethod, &c.PasswordEncrypted, &c.PrivateKeyEncrypted, &c.PrivateKeyPassphraseEncrypted, &c.CreatedBy, &c.Shared, &c.MaxSessions, &c.Tag, &c.Color, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, err
		}
		conns = append(conns, c)
	}
	return conns, nil
}

func (s *Store) GetConnection(id int64) (*Connection, error) {
	c := &Connection{}
	err := s.DB.QueryRow(
		"SELECT id, group_id, name, host, port, username, auth_method, password_encrypted, private_key_encrypted, private_key_passphrase_encrypted, created_by, shared, max_sessions, created_at, updated_at FROM connections WHERE id=?",
		id,
	).Scan(&c.ID, &c.GroupID, &c.Name, &c.Host, &c.Port, &c.Username, &c.AuthMethod, &c.PasswordEncrypted, &c.PrivateKeyEncrypted, &c.PrivateKeyPassphraseEncrypted, &c.CreatedBy, &c.Shared, &c.MaxSessions, &c.CreatedAt, &c.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return c, nil
}

func (s *Store) CreateConnection(c *Connection) (int64, error) {
	res, err := s.DB.Exec(
		"INSERT INTO connections (group_id, name, host, port, username, auth_method, password_encrypted, private_key_encrypted, private_key_passphrase_encrypted, created_by, shared, max_sessions, tag, color) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
		c.GroupID, c.Name, c.Host, c.Port, c.Username, c.AuthMethod, c.PasswordEncrypted, c.PrivateKeyEncrypted, c.PrivateKeyPassphraseEncrypted, c.CreatedBy, c.Shared, c.MaxSessions, c.Tag, c.Color,
	)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func (s *Store) UpdateConnection(c *Connection) error {
	_, err := s.DB.Exec(
		"UPDATE connections SET group_id=?, name=?, host=?, port=?, username=?, auth_method=?, password_encrypted=?, private_key_encrypted=?, private_key_passphrase_encrypted=?, shared=?, max_sessions=?, tag=?, color=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
		c.GroupID, c.Name, c.Host, c.Port, c.Username, c.AuthMethod, c.PasswordEncrypted, c.PrivateKeyEncrypted, c.PrivateKeyPassphraseEncrypted, c.Shared, c.MaxSessions, c.Tag, c.Color, c.ID,
	)
	return err
}

func (s *Store) DeleteConnection(id int64) error {
	_, err := s.DB.Exec("DELETE FROM connections WHERE id=?", id)
	return err
}
