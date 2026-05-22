package store

import "time"

type DbConnection struct {
	ID                int64     `json:"id"`
	GroupID           int64     `json:"group_id"`
	Name              string    `json:"name"`
	Host              string    `json:"host"`
	Port              int       `json:"port"`
	Username          string    `json:"username"`
	PasswordEncrypted string    `json:"-"`
	DatabaseName      string    `json:"database_name"`
	Engine            string    `json:"engine"`
	CreatedBy         int64     `json:"created_by"`
	Shared            bool      `json:"shared"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
}

func (s *Store) ListDbConnections() ([]DbConnection, error) {
	rows, err := s.DB.Query(
		"SELECT id, group_id, name, host, port, username, password_encrypted, database_name, engine, created_by, shared, created_at, updated_at FROM db_connections ORDER BY name",
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	conns := make([]DbConnection, 0)
	for rows.Next() {
		var c DbConnection
		if err := rows.Scan(&c.ID, &c.GroupID, &c.Name, &c.Host, &c.Port, &c.Username, &c.PasswordEncrypted, &c.DatabaseName, &c.Engine, &c.CreatedBy, &c.Shared, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, err
		}
		conns = append(conns, c)
	}
	return conns, nil
}

func (s *Store) GetDbConnection(id int64) (*DbConnection, error) {
	c := &DbConnection{}
	err := s.DB.QueryRow(
		"SELECT id, group_id, name, host, port, username, password_encrypted, database_name, engine, created_by, shared, created_at, updated_at FROM db_connections WHERE id=?",
		id,
	).Scan(&c.ID, &c.GroupID, &c.Name, &c.Host, &c.Port, &c.Username, &c.PasswordEncrypted, &c.DatabaseName, &c.Engine, &c.CreatedBy, &c.Shared, &c.CreatedAt, &c.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return c, nil
}

func (s *Store) CreateDbConnection(c *DbConnection) (int64, error) {
	res, err := s.DB.Exec(
		"INSERT INTO db_connections (group_id, name, host, port, username, password_encrypted, database_name, engine, created_by, shared) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
		c.GroupID, c.Name, c.Host, c.Port, c.Username, c.PasswordEncrypted, c.DatabaseName, c.Engine, c.CreatedBy, c.Shared,
	)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func (s *Store) UpdateDbConnection(c *DbConnection) error {
	_, err := s.DB.Exec(
		"UPDATE db_connections SET group_id=?, name=?, host=?, port=?, username=?, password_encrypted=?, database_name=?, shared=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
		c.GroupID, c.Name, c.Host, c.Port, c.Username, c.PasswordEncrypted, c.DatabaseName, c.Shared, c.ID,
	)
	return err
}

func (s *Store) DeleteDbConnection(id int64) error {
	_, err := s.DB.Exec("DELETE FROM db_connections WHERE id=?", id)
	return err
}
