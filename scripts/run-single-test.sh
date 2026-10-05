#!/bin/bash
cd /data/data/com.termux/files/home/digital-platform-v4.2
pnpm vitest run "$1" 2>&1
