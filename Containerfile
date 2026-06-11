# Embercleave OS — derived podman machine image (see arch.md).
# Tag must track the podman version inside the VM (arch.md D1).
FROM quay.io/podman/machine-os:5.8

# Quadlets under users/ are instantiated for every linger-enabled user;
# on machine-os that is exactly `core` (arch.md D5).
COPY os/embercleave-hello.container /etc/containers/systemd/users/

RUN echo "embercleave dev $(date -u +%Y-%m-%dT%H:%M:%SZ)" > /usr/lib/embercleave-release

RUN bootc container lint
