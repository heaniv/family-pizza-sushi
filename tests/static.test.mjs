import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve('dist');const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
test('local links, images and stylesheet references exist',()=>{for(const m of html.matchAll(/(?:href|src)="(\/[^\"]*)"/g))assert.ok(fs.existsSync(path.join(root,m[1])),m[1]);for(const m of fs.readFileSync(path.join(root,'assets/fonts.css'),'utf8').matchAll(/url\(\.\/([^)]+)\)/g))assert.ok(fs.existsSync(path.join(root,'assets',m[1])));});
test('anchor targets and ids are valid; outgoing links use safe destinations',()=>{const ids=[...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length);for(const m of html.matchAll(/href="#([^"]+)"/g))assert.ok(ids.includes(m[1]),m[1]);assert.ok(!/href="(?:#|javascript:)/.test(html.replace(/href="#[^"]+"/g,'')));for(const m of html.matchAll(/<a\b[^>]*target="_blank"[^>]*>/g))assert.match(m[0],/rel="noopener noreferrer"/);});
test('restaurant schema and page language match verified cafe data',()=>{assert.match(html,/<html lang="uk">/);const data=JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);assert.equal(data.telephone,'+380997206560');assert.equal(data.openingHours,'Mo-Su 11:00-22:00');assert.equal(data.address.addressLocality,'Богородчани');assert.equal((html.match(/<h1>/g)||[]).length,1);});
