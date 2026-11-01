import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { canRead, findComments } from "./find-comments.ts";

const listed = execFileSync(
	"git",
	["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
	{ encoding: "utf8" },
);
const files = listed
	.split("\0")
	.filter((file) => file && canRead(file) && existsSync(file));

const hits = files.flatMap((file) =>
	findComments(file, readFileSync(file, "utf8")),
);

for (const { file, line, text } of hits) {
	console.error(`${file}:${line}  ${text}`);
}

if (hits.length > 0) {
	console.error(
		`\n${hits.length} comments found. Comments are banned: put the reason in code, a test, biome.json, or the README.`,
	);
	process.exit(1);
}

console.log(`No comments in ${files.length} files.`);
