/**
 * Read-only port for `podman inspect <container>`. v1 shells out; v2
 * may switch to the libpod REST socket per arch.md:215. The shape is
 * deliberately a single inspect call, since that's all `swarm_inspect`
 * needs.
 */
export interface PodmanPort {
  inspectContainer(containerName: string): Promise<unknown>;
}
