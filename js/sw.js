// Establish a cache name
const cacheName = "ProductCache";

// Assets to precache
const precachedAssets = [
  "data/StoreData.binpb.zst",
  "data/ItemData.binpb.zst",
  "data/PromoData.binpb.zst"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(cacheName).then(cache => {
    return cache.addAll(precachedAssets);
  }));
});
/*
self.addEventListener("fetch", event => {
  const isPrecachedRequest = precachedAssets.includes(event.request.url);
  
  if (isPrecachedRequest) {
    event.respondWith(caches.open(cacheName).then(cache => {
      console.log("Cache only request for: " + event.request.url);

      return cache.match(event.request.url);
    }));
  } else {
    console.log("Network only request for: " + event.request.url);

    return;
  }
});
*/

async function cacheFirstWithRefresh(request) {
  const fetchResponsePromise = fetch(request).then(async (networkResponse) => {
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  });

  return (await caches.match(request)) || (await fetchResponsePromise);
}

self.addEventListener("fetch", (event) => {
  event.respondWith(cacheFirstWithRefresh(event.request));
});
