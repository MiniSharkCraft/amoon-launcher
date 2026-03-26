// src/constants/icons.js — Icon maps for loaders, auth types, installations
import {
  Cube, Scissors, Hammer, Wrench, PuzzlePiece,
  MicrosoftOutlookLogo, Globe, Crown, WifiSlash,
} from "@phosphor-icons/react";

export const LOADER_ICONS = {
  vanilla:  (s = 16, w = "duotone") => <Cube size={s} weight={w} />,
  fabric:   (s = 16, w = "duotone") => <Scissors size={s} weight={w} />,
  forge:    (s = 16, w = "duotone") => <Hammer size={s} weight={w} />,
  neoforge: (s = 16, w = "duotone") => <Wrench size={s} weight={w} />,
  quilt:    (s = 16, w = "duotone") => <PuzzlePiece size={s} weight={w} />,
};

export const AUTH_ICONS = {
  microsoft: <MicrosoftOutlookLogo size={18} weight="duotone" />,
  elyby:     <Globe size={18} weight="duotone" />,
  amoon:     <Crown size={18} weight="duotone" />,
  offline:   <WifiSlash size={18} weight="duotone" />,
};

export const INSTALL_ICONS = {
  vanilla:  <Cube size={18} weight="duotone" color="#22c55e" />,
  fabric:   <Scissors size={18} weight="duotone" color="#dbb86c" />,
  forge:    <Hammer size={18} weight="duotone" color="#e06c3c" />,
  neoforge: <Wrench size={18} weight="duotone" color="#f59e0b" />,
  quilt:    <PuzzlePiece size={18} weight="duotone" color="#a78bfa" />,
};
