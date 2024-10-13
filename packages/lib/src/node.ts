import type { NeoNode, NeoNodeInformation } from "./types"

export function isNeoNode(node: Node): node is NeoNode {
  return "$neo" in node
}

export function setNeoNodeInfo(node: Node, info: NeoNodeInformation): NeoNode {
  return Object.assign(node, { $neo: info })
}

export function getNeoNodeInfo(node: Node): NeoNodeInformation | null {
  if (!isNeoNode(node)) return null
  return node.$neo
}
