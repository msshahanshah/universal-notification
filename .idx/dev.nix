nix
let
  myPackages = { self, pkgs, ... }: {
    environment.systemPackages = [
      pkgs.docker
      pkgs.docker-compose
    ];
    environment.variables = {
      DOCKER_HOST = "unix:///var/run/docker.sock";
    };
  };