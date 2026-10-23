import assert from 'node:assert/strict';
import {test} from 'node:test';
import {authSecurity} from './helpers/auth-security.mjs';
const {temporaryPasswordExpiry,temporaryPasswordExpired,isVerifiedRecovery,loginBucketHash}=authSecurity;
test('temporary credentials expire exactly after 24 hours, including missing or invalid expiry',()=>{
 const now=Date.parse('2026-10-23T12:00:00Z'); const expiry=temporaryPasswordExpiry(now);
 assert.equal(expiry,'2026-10-24T12:00:00.000Z');
 assert.equal(temporaryPasswordExpired({must_change_password:true,temporary_password_expires_at:expiry},now),false);
 assert.equal(temporaryPasswordExpired({must_change_password:true,temporary_password_expires_at:expiry},now+86400000),true);
 for(const value of [null,undefined,'invalid','2026-10-22']) assert.equal(temporaryPasswordExpired({must_change_password:true,temporary_password_expires_at:value},now),true);
 assert.equal(temporaryPasswordExpired({must_change_password:false},now),false);
});
test('the recovery exception requires the same authenticated identity and recovery AMR, never a body flag',()=>{
 const token=claims=>'Bearer header.'+Buffer.from(JSON.stringify(claims)).toString('base64url')+'.signature';
 assert.equal(isVerifiedRecovery(token({sub:'user',amr:[{method:'recovery'}]}),'user'),true);
 for(const claims of [{sub:'other',amr:[{method:'recovery'}]},{sub:'user',amr:[{method:'password'}]},{sub:'user',recovery:true},{sub:'user',amr:'recovery'}]) assert.equal(isVerifiedRecovery(token(claims),'user'),false);
 assert.equal(isVerifiedRecovery('invalid','user'),false);
});
test('login bucket identifiers are keyed hashes and never contain usernames or raw IP addresses',async()=>{
 const hash=await loginBucketHash('test-secret','account:test-user'); assert.match(hash,/^[0-9a-f]{64}$/);
 assert.equal(hash,await loginBucketHash('test-secret','account:test-user'));
 assert.notEqual(hash,await loginBucketHash('other-secret','account:test-user'));
 assert.notEqual(hash,await loginBucketHash('test-secret','origin:test-user'));
});
