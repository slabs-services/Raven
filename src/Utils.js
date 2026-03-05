let cachedKey = null;

export async function getPubKey() {
  if (cachedKey){
    return cachedKey;
  }

  const res = await fetch("http://utils-keys.lake.tryspacelabs.pt/5a71f2d8-cf5a-4922-9b54-71cf9b3020d8.pub");
  cachedKey = await res.text();
  return cachedKey;
}

export function slugify(str) {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");
}