const newReq = (url, request) => new Request(url.toString(), {
  body: request.body,
  headers: request.headers,
  method: request.method,
  redirect: request.redirect,
})
const supaId = 'xvwzpoazmxkqosrdewyv'
const supaHost = `${supaId}.functions.supabase.co`
const transform = {
  default: async (request) => {
    const urlNew = new URL(request.url)
    const end = urlNew.pathname.split('/').pop()
    urlNew.hostname = supaHost
    urlNew.pathname = `/${end}`
    const headers = {
      ...Object.fromEntries(request.headers.entries()),
      host: urlNew.host,
    }
    return newReq(urlNew, {
      ...request,
      headers,
    })
  },
  auto_update: async (request) => {
    const urlNew = new URL(request.url)
    urlNew.pathname = '/api/updates'
    return transform.default(newReq(urlNew, {
      ...request,
      method: 'POST',
      body: JSON.stringify({
        version_name: request.headers.get('cap_version_name'),
        version_build: request.headers.get('cap_version_build'),
        plugin_version: request.headers.get('cap_plugin_version'),
        platform: request.headers.get('cap_platform'),
        app_id: request.headers.get('cap_app_id'),
        device_id: request.headers.get('cap_device_id'),
      }),
    }))
  },
}

async function handleRequest(request) {
  const url = new URL(request.url)
  const end = url.pathname.split('/').pop()
  // console.log('end', end, !!transform[end] )
  const req = transform[end] ? await transform[end](request) : await transform.default(request)
  return fetch(req.url, req)
}

addEventListener('fetch', (event) => {
  event.respondWith(handleRequest(event.request))
})