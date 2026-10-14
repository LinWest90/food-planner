import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchPage, FetchPageError, isPrivateAddress } from "./fetch-page.ts";

test("private and internal addresses are recognized", () => {
  for (const ip of ["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"]) {
    assert.equal(isPrivateAddress(ip), true, ip);
  }
  for (const ip of ["8.8.8.8", "151.101.1.1", "172.32.0.1", "2606:4700::1111"]) {
    assert.equal(isPrivateAddress(ip), false, ip);
  }
});

test("refuses non-web, local and private links before fetching", async () => {
  for (const url of ["ftp://example.com/x", "http://localhost:3000/", "http://127.0.0.1/", "http://[::1]/", "http://169.254.169.254/latest/meta-data", "not a link", "http://user:pw@example.com/"]) {
    await assert.rejects(fetchPage(url), FetchPageError, url);
  }
});
