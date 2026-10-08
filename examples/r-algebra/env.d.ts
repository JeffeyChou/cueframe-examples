declare module '*?url' {
  const url: string
  export default url
}
interface ImportMeta { glob(p: string, o: object): Record<string, string> }
