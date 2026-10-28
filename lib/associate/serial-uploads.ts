// Uploads for one customer go to the server one at a time. The backend records each file by
// reading the customer's file list, adding one and writing the list back, so two uploads in
// flight together can overwrite each other and a document the associate saw attached goes
// missing at submit (seen on slow 4G in FE-19's phone pass). One at a time removes the race.

const chains = new Map<string, Promise<unknown>>()

/** Runs `task` after every earlier task queued under `key` has settled. */
export function inTurn<T>(key: string, task: () => Promise<T>): Promise<T> {
  const before = chains.get(key) ?? Promise.resolve()
  const run = before.then(task, task)
  const settled = run.then(
    () => undefined,
    () => undefined,
  )
  chains.set(key, settled)
  void settled.then(() => {
    if (chains.get(key) === settled) chains.delete(key)
  })
  return run
}
