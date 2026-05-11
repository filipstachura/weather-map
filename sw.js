const CACHE='dol26-v1';
const CDN_ASSETS=[
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
];

self.addEventListener('install',e=>{
  e.waitUntil(
    caches.open(CACHE).then(c=>c.addAll(['./',...CDN_ASSETS]))
  );
  self.skipWaiting();
});

self.addEventListener('activate',e=>{
  e.waitUntil(
    caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch',e=>{
  const url=new URL(e.request.url);

  if(url.hostname.includes('basemaps.cartocdn.com')){
    e.respondWith(caches.open(CACHE).then(c=>
      c.match(e.request).then(r=>{
        if(r)return r;
        return fetch(e.request).then(resp=>{
          if(resp.ok)c.put(e.request,resp.clone());
          return resp;
        }).catch(()=>new Response('',{status:404}));
      })
    ));
    return;
  }

  if(url.hostname==='unpkg.com'){
    e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));
    return;
  }

  if(url.hostname==='api.open-meteo.com'){
    e.respondWith(fetch(e.request).catch(()=>new Response('{}',{status:503})));
    return;
  }

  if(e.request.mode==='navigate'){
    e.respondWith(
      fetch(e.request).then(resp=>{
        const clone=resp.clone();
        caches.open(CACHE).then(c=>c.put(e.request,clone));
        return resp;
      }).catch(()=>caches.match(e.request))
    );
    return;
  }

  e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)));
});

self.addEventListener('message',e=>{
  if(e.data&&e.data.type==='PRECACHE_TILES'){
    const tiles=e.data.urls;
    caches.open(CACHE).then(c=>{
      let i=0;
      const batch=()=>{
        const chunk=tiles.slice(i,i+6);
        if(!chunk.length)return;
        i+=6;
        Promise.all(chunk.map(u=>c.match(u).then(r=>{
          if(r)return;
          return fetch(u).then(resp=>{if(resp.ok)c.put(u,resp)}).catch(()=>{});
        }))).then(()=>setTimeout(batch,200));
      };
      batch();
    });
  }
});
