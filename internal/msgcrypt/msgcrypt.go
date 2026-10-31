// Package msgcrypt encrypts message bodies at rest (NFR-4, TR-14).
//
// MVP scheme: AES-256-GCM with a single key from SOCKABUS_MESSAGE_KEY; messages.dek_ref records which
// key sealed the row ("local:v1") so a later move to per-conversation data keys wrapped by a KMS
// (full envelope encryption, TR-14 in M3) can decrypt old rows. Ciphertext layout: nonce || sealed.
package msgcrypt

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
)

const KeyRefLocalV1 = "local:v1"

type Box struct {
	ref  string
	aead cipher.AEAD
}

// New builds a Box from a base64-encoded 32-byte key (generate with: openssl rand -base64 32).
func New(b64Key string) (*Box, error) {
	if b64Key == "" {
		return nil, errors.New("msgcrypt: SOCKABUS_MESSAGE_KEY is required in live mode (openssl rand -base64 32)")
	}
	key, err := base64.StdEncoding.DecodeString(b64Key)
	if err != nil {
		return nil, fmt.Errorf("msgcrypt: key is not valid base64: %w", err)
	}
	if len(key) != 32 {
		return nil, fmt.Errorf("msgcrypt: key must be 32 bytes, got %d", len(key))
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	return &Box{ref: KeyRefLocalV1, aead: aead}, nil
}

// Seal encrypts plaintext and returns the ciphertext plus the key reference to store in dek_ref.
// aad binds the ciphertext to its row context (e.g. conversation id) so rows cannot be swapped.
func (b *Box) Seal(plaintext, aad []byte) (ciphertext []byte, keyRef string, err error) {
	nonce := make([]byte, b.aead.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return nil, "", err
	}
	return b.aead.Seal(nonce, nonce, plaintext, aad), b.ref, nil
}

func (b *Box) Open(ciphertext []byte, keyRef string, aad []byte) ([]byte, error) {
	if keyRef != b.ref {
		return nil, fmt.Errorf("msgcrypt: unknown key ref %q", keyRef)
	}
	n := b.aead.NonceSize()
	if len(ciphertext) < n {
		return nil, errors.New("msgcrypt: ciphertext too short")
	}
	return b.aead.Open(nil, ciphertext[:n], ciphertext[n:], aad)
}
