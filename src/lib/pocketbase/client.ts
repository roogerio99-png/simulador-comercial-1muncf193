import PocketBase from 'pocketbase'

const pocketbaseUrl =
  import.meta.env.VITE_POCKETBASE_URL ||
  'https://validacao-de-cadastro-c8eaa.shrd01.internal.goskip.dev'

const pb = new PocketBase(pocketbaseUrl)
pb.autoCancellation(false)

export default pb
