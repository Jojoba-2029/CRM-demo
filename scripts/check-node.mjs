// Yarn 4 не проверяет поле engines, поэтому проверяем версию Node сами.
// Запускается в postinstall и перед dev/build.
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

const required = JSON.parse(read("../package.json")).engines?.node ?? "";
const match = /^>=(\d+\.\d+(?:\.\d+)?)$/.exec(required);
if (!match) {
  console.error(
    `check-node: неподдерживаемый формат engines.node: "${required}" (ожидается ">=X.Y[.Z]")`,
  );
  process.exit(1);
}
const minimum = match[1];

// .node-version (для nvm/fnm/хостингов) должен совпадать с engines.node
const pinned = read("../.node-version").trim();
if (pinned !== minimum) {
  console.error(
    `check-node: .node-version (${pinned}) не совпадает с engines.node (${required}) в package.json`,
  );
  process.exit(1);
}

// parseInt отбрасывает суффиксы вроде "0-nightly2026…"
const toTuple = (version) => {
  const [major = 0, minor = 0, patch = 0] = version
    .split(".")
    .map((part) => Number.parseInt(part, 10) || 0);
  return [major, minor, patch];
};
const compare = (a, b) => a.map((v, i) => v - b[i]).find((d) => d !== 0) ?? 0;

if (compare(toTuple(process.versions.node), toTuple(minimum)) < 0) {
  console.error(
    `Нужен Node.js ${required}, установлен ${process.versions.node}. Нужная версия указана в .node-version.`,
  );
  process.exit(1);
}
