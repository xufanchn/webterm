package config

import (
	"gopkg.in/yaml.v3"
	"os"
)

type Config struct {
	Port            int    `yaml:"port"`
	EncryptionKey   string `yaml:"encryption_key"`
	LogLevel        string `yaml:"log_level"`
	SSHHostKeyCheck bool   `yaml:"ssh_host_key_check"`
}

func Load(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	cfg := &Config{Port: 8888, LogLevel: "info"}
	if err := yaml.Unmarshal(data, cfg); err != nil {
		return nil, err
	}
	return cfg, nil
}
