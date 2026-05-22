package config

import (
	"os"
	"gopkg.in/yaml.v3"
)

type Config struct {
	Port          int    `yaml:"port"`
	EncryptionKey string `yaml:"encryption_key"`
	LogLevel      string `yaml:"log_level"`
}

func Load(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	cfg := &Config{Port: 8443, LogLevel: "info"}
	if err := yaml.Unmarshal(data, cfg); err != nil {
		return nil, err
	}
	return cfg, nil
}
