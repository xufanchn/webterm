package store

import "time"

type SessionLog struct {
	ID           int64      `json:"id"`
	UserID       int64      `json:"user_id"`
	ConnectionID int64      `json:"connection_id"`
	Type         string     `json:"type"`
	StartedAt    time.Time  `json:"started_at"`
	EndedAt      *time.Time `json:"ended_at"`
}

func (s *Store) CreateSessionLog(log *SessionLog) (int64, error) {
	res, err := s.DB.Exec(
		"INSERT INTO session_logs (user_id, connection_id, type) VALUES (?, ?, ?)",
		log.UserID, log.ConnectionID, log.Type,
	)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func (s *Store) EndSessionLog(id int64) error {
	_, err := s.DB.Exec("UPDATE session_logs SET ended_at=CURRENT_TIMESTAMP WHERE id=?", id)
	return err
}
