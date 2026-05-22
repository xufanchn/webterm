package dbmgr

import (
	"database/sql"
	"fmt"
	"time"

	_ "github.com/go-sql-driver/mysql"
)

type Client struct {
	db  *sql.DB
	dsn string
}

func NewClient(host string, port int, username, password, database string) (*Client, error) {
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?charset=utf8mb4&parseTime=true&timeout=10s&readTimeout=30s",
		username, password, host, port, database)
	db, err := sql.Open("mysql", dsn)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(5)
	db.SetMaxIdleConns(2)
	db.SetConnMaxLifetime(5 * time.Minute)
	if err := db.Ping(); err != nil {
		db.Close()
		return nil, err
	}
	return &Client{db: db, dsn: dsn}, nil
}

func (c *Client) Close() error {
	return c.db.Close()
}

func (c *Client) Execute(query string) (*QueryResult, error) {
	rows, err := c.db.Query(query)
	if err != nil {
		// Try exec for non-SELECT statements
		result, execErr := c.db.Exec(query)
		if execErr != nil {
			return nil, err // return original error
		}
		affected, _ := result.RowsAffected()
		lastID, _ := result.LastInsertId()
		return &QueryResult{
			Columns:      []string{},
			Rows:         []map[string]interface{}{},
			RowsAffected: affected,
			LastInsertID: lastID,
		}, nil
	}
	defer rows.Close()

	columns, err := rows.Columns()
	if err != nil {
		return nil, err
	}

	var result []map[string]interface{}
	rowCount := 0
	for rows.Next() && rowCount < 1000 {
		values := make([]interface{}, len(columns))
		valuePtrs := make([]interface{}, len(columns))
		for i := range values {
			valuePtrs[i] = &values[i]
		}
		if err := rows.Scan(valuePtrs...); err != nil {
			return nil, err
		}
		row := make(map[string]interface{})
		for i, col := range columns {
			val := values[i]
			if b, ok := val.([]byte); ok {
				row[col] = string(b)
			} else {
				row[col] = val
			}
		}
		result = append(result, row)
		rowCount++
	}

	return &QueryResult{
		Columns: columns,
		Rows:    result,
	}, nil
}

type QueryResult struct {
	Columns      []string                 `json:"columns"`
	Rows         []map[string]interface{} `json:"rows"`
	RowsAffected int64                    `json:"rows_affected"`
	LastInsertID int64                    `json:"last_insert_id"`
}

func (c *Client) ListDatabases() ([]string, error) {
	rows, err := c.db.Query("SHOW DATABASES")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var dbs []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, err
		}
		dbs = append(dbs, name)
	}
	return dbs, nil
}

func (c *Client) ListTables(database string) ([]string, error) {
	rows, err := c.db.Query(fmt.Sprintf("SHOW TABLES FROM `%s`", database))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var tables []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, err
		}
		tables = append(tables, name)
	}
	return tables, nil
}

type ColumnInfo struct {
	Name     string `json:"name"`
	Type     string `json:"type"`
	Nullable string `json:"nullable"`
	Key      string `json:"key"`
	Default  string `json:"default"`
	Extra    string `json:"extra"`
	Comment  string `json:"comment"`
}

func (c *Client) DescribeTable(database, table string) ([]ColumnInfo, error) {
	rows, err := c.db.Query(fmt.Sprintf("SHOW FULL COLUMNS FROM `%s`.`%s`", database, table))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var cols []ColumnInfo
	for rows.Next() {
		var col ColumnInfo
		var null sql.NullString
		var def sql.NullString
		var comment sql.NullString
		if err := rows.Scan(&col.Name, &col.Type, &null, &col.Key, &def, &col.Extra, &sql.NullString{}, &comment); err != nil {
			return nil, err
		}
		if null.Valid {
			col.Nullable = null.String
		}
		if def.Valid {
			col.Default = def.String
		}
		if comment.Valid {
			col.Comment = comment.String
		}
		cols = append(cols, col)
	}
	return cols, nil
}
