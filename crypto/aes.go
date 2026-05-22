package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"io"
)

type AESCipher struct {
	key []byte
}

func New(keyHex string) (*AESCipher, error) {
	key, err := hex.DecodeString(keyHex)
	if err != nil {
		return nil, err
	}
	if len(key) != 32 {
		return nil, errors.New("encryption key must be 32 bytes (64 hex chars)")
	}
	return &AESCipher{key: key}, nil
}

func (c *AESCipher) Encrypt(plaintext string) (string, error) {
	block, err := aes.NewCipher(c.key)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}
	ciphertext := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return hex.EncodeToString(ciphertext), nil
}

func (c *AESCipher) Decrypt(encryptedHex string) (string, error) {
	data, err := hex.DecodeString(encryptedHex)
	if err != nil {
		return "", err
	}
	block, err := aes.NewCipher(c.key)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonceSize := gcm.NonceSize()
	if len(data) < nonceSize {
		return "", errors.New("ciphertext too short")
	}
	nonce, ciphertext := data[:nonceSize], data[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", err
	}
	return string(plaintext), nil
}
