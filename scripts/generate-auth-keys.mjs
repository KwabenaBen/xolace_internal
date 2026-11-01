// Generates the RS256 key pair Convex Auth uses to sign session tokens.
// Writes .auth-keys/jwt_private_key.txt and .auth-keys/jwks.json (git-ignored); upload them with
//   bunx convex env set JWT_PRIVATE_KEY --from-file .auth-keys/jwt_private_key.txt
//   bunx convex env set JWKS --from-file .auth-keys/jwks.json
// then delete the folder. Adapted from https://labs.convex.dev/auth/setup/manual.
import { mkdirSync, writeFileSync } from "node:fs";

import { exportJWK, exportPKCS8, generateKeyPair } from "jose";

const keys = await generateKeyPair("RS256", { extractable: true });
const privateKey = await exportPKCS8(keys.privateKey);
const publicKey = await exportJWK(keys.publicKey);
const jwks = JSON.stringify({ keys: [{ use: "sig", ...publicKey }] });

mkdirSync(".auth-keys", { recursive: true });
// Convex Auth expects the PEM on one line, with newlines replaced by spaces.
writeFileSync(".auth-keys/jwt_private_key.txt", privateKey.trimEnd().replace(/\n/g, " "));
writeFileSync(".auth-keys/jwks.json", jwks);
console.log("Wrote .auth-keys/jwt_private_key.txt and .auth-keys/jwks.json");
