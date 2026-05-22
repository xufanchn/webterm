package store

import "time"

type Group struct {
	ID        int64     `json:"id"`
	Name      string    `json:"name"`
	Type      string    `json:"type"`
	ParentID  int64     `json:"parent_id"`
	SortOrder int       `json:"sort_order"`
	CreatedAt time.Time `json:"created_at"`
}

func (s *Store) ListGroups(groupType string) ([]Group, error) {
	rows, err := s.DB.Query(
		"SELECT id, name, type, parent_id, sort_order, created_at FROM groups_t WHERE type=? ORDER BY sort_order, id",
		groupType,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	groups := make([]Group, 0)
	for rows.Next() {
		var g Group
		if err := rows.Scan(&g.ID, &g.Name, &g.Type, &g.ParentID, &g.SortOrder, &g.CreatedAt); err != nil {
			return nil, err
		}
		groups = append(groups, g)
	}
	return groups, nil
}

func (s *Store) CreateGroup(name, groupType string, parentID int64) (int64, error) {
	res, err := s.DB.Exec(
		"INSERT INTO groups_t (name, type, parent_id) VALUES (?, ?, ?)",
		name, groupType, parentID,
	)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func (s *Store) UpdateGroup(id int64, name string) error {
	_, err := s.DB.Exec("UPDATE groups_t SET name=? WHERE id=?", name, id)
	return err
}

func (s *Store) DeleteGroup(id int64) error {
	_, err := s.DB.Exec("DELETE FROM groups_t WHERE id=?", id)
	return err
}
