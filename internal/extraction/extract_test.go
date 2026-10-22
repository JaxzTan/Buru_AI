package extraction

import "testing"

func TestExtract(t *testing.T) {
	cases := []struct {
		text, typ, value string
	}{
		{"Transfer to Maybank 5621 0384 1192 now", "bank_account", "562103841192"},
		{"call me +60 11-2345 6789", "phone", "+601123456789"},
		{"send USDT to TUiNnd7ic6yCmaLmyuE7g7ZF5XYURYLBwR", "wallet", "TUiNnd7ic6yCmaLmyuE7g7ZF5XYURYLBwR"},
		{"login at http://maybank2u-secure-verify.top/login", "url", "maybank2u-secure-verify.top/login"},
	}
	for _, c := range cases {
		got := Extract(c.text)
		if len(got) != 1 || got[0].Type != c.typ || got[0].Value != c.value {
			t.Errorf("%q → %+v, want %s %s", c.text, got, c.typ, c.value)
		}
	}
	if got := Extract("Maybank 12345678901234"); len(got) != 0 {
		t.Errorf("wrong-length Maybank account must be rejected, got %+v", got)
	}
	if got := Extract("send to TQ7vR2mXc8kLpW4nYb6sHd3fJ9eA1u9xKp"); len(got) != 0 {
		t.Errorf("bad checksum wallet must be rejected, got %+v", got)
	}
	if Classify("I am from PDRM, you have a court case") != "impersonation" {
		t.Error("classify impersonation")
	}
}
