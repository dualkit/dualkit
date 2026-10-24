import { spawn } from 'node:child_process'
import { connect } from 'node:net'

/** Thrown when the app's server cannot be started or never answers. The message ends with the last lines of its output. */
export class ServerError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ServerError'
  }
}

const OUTPUT_LINES = 20
const POLL_MS = 250
const KILL_GRACE_MS = 5_000

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

function portTaken(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ port, host: 'localhost' })
    socket.once('connect', () => { socket.destroy(); resolve(true) })
    socket.once('error', () => resolve(false))
  })
}

async function answers(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2_000), redirect: 'manual' })
    return res.status < 500
  } catch {
    return false
  }
}

function groupAlive(pid: number): boolean {
  try {
    process.kill(-pid, 0)
    return true
  } catch {
    return false
  }
}

function signalGroup(pid: number, signal: NodeJS.Signals): void {
  try {
    process.kill(-pid, signal)
  } catch {
    // the group is already gone
  }
}

/** Starts cmd in its own process group and waits until http://localhost:port/ answers below 500. `stop` kills the whole group and waits for it to exit. */
export async function startServer(
  cmd: string, port: number, cwd: string, timeoutMs = 120_000,
): Promise<{ url: string; stop: () => Promise<void> }> {
  if (await portTaken(port)) {
    throw new ServerError(`Port ${port} is already in use. Stop whatever is running there or set another port in dualkit.config.json.`)
  }
  const child = spawn(cmd, { cwd, shell: true, detached: true, stdio: ['ignore', 'pipe', 'pipe'] })
  let output = ''
  let exited = false
  let spawnError: Error | null = null
  child.on('error', (error) => { spawnError = error; output += `${error.message}\n` })
  const pid = child.pid
  if (pid === undefined) {
    await new Promise((resolve) => setImmediate(resolve))
    throw new ServerError(`Could not start "${cmd}": ${(spawnError as Error | null)?.message ?? 'no process id'}`)
  }
  const collect = (chunk: Buffer): void => { output += chunk.toString() }
  child.stdout?.on('data', collect)
  child.stderr?.on('data', collect)
  child.on('exit', () => { exited = true })

  const stop = async (): Promise<void> => {
    signalGroup(pid, 'SIGTERM')
    const deadline = Date.now() + KILL_GRACE_MS
    while ((!exited || groupAlive(pid)) && Date.now() < deadline) await sleep(50)
    if (!exited || groupAlive(pid)) {
      signalGroup(pid, 'SIGKILL')
      while ((!exited || groupAlive(pid)) && Date.now() < deadline + KILL_GRACE_MS) await sleep(50)
    }
  }
  const tail = (): string => output.trimEnd().split('\n').slice(-OUTPUT_LINES).join('\n')

  const url = `http://localhost:${port}`
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (exited) {
      await stop()
      throw new ServerError(`The server command "${cmd}" exited before it answered.\n${tail()}`)
    }
    if (await answers(`${url}/`)) return { url, stop }
    await sleep(POLL_MS)
  }
  await stop()
  throw new ServerError(`The server did not answer on port ${port} within ${Math.round(timeoutMs / 1000)} seconds.\n${tail()}`)
}
