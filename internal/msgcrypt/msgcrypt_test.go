package msgcrypt

import (
	"bytes"
	"encoding/base64"
	"testing"
)

func TestRoundTrip(t *testing.T) {
	key := base64.StdEncoding.EncodeToString(bytes.Repeat([]byte{7}, 32))
	b, err := New(key)
	if err != nil {
		t.Fatal(err)
	}
	ct, ref, err := b.Seal([]byte("send to Maybank 1642 0457 1893"), []byte("conv:1"))
	if err != nil {
		t.Fatal(err)
	}
	if bytes.Contains(ct, []byte("Maybank")) {
		t.Fatal("ciphertext contains plaintext")
	}
	pt, err := b.Open(ct, ref, []byte("conv:1"))
	if err != nil || string(pt) != "send to Maybank 1642 0457 1893" {
		t.Fatalf("open = %q, %v", pt, err)
	}
	if _, err := b.Open(ct, ref, []byte("conv:2")); err == nil {
		t.Fatal("open with wrong aad should fail")
	}
}

func TestBadKeys(t *testing.T) {
	for _, k := range []string{"", "not-base64!!", base64.StdEncoding.EncodeToString([]byte("short"))} {
		if _, err := New(k); err == nil {
			t.Errorf("New(%q) should fail", k)
		}
	}
}
