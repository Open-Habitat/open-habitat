import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  renderSound,
  SAMPLE_RATE,
  type SoundLength,
  soundDuration,
  soundIds,
  soundStrikes,
} from "./soundSynth";

// SHA-256 over interleaved 16-bit PCM, as the accepted prototype round
// (2026-11-21-attention-sounds-4/fingerprints.json) recorded them: the
// browser plays exactly the sounds Jari chose. A changed fingerprint is a
// changed sound; update it only with a recipe change made on purpose.
const accepted: Record<string, string> = {
  "kalimba/short":
    "cc9f19b32183920dc3661ae7af31a8c03e6d6fc6598a07f70584128c3dc2019f",
  "kalimba/long":
    "b5523ccd1e2a59dcafd606096a8e7299459d5f7ecfb4839820945d183c8927c0",
  "marimba/short":
    "87f0a815a1f3dd8178561e932a07e42c6eade66e115a852498c4f0dc8eb946ba",
  "marimba/long":
    "14d184b58e89d4b7032068c13cd062a73e7c93b92e6f7e08319d8773d9074469",
  "vibrafoni/short":
    "b515aab3b46ee2c7c7e7bff6614fdcdc4d9cbfffb2a6319b0608d2c907c73aad",
  "vibrafoni/long":
    "16549331e90365670ad26b2605b6ff419ab62bb1422a2661c2c34ea2e17ae4a9",
  "tunnus-puu/short":
    "6beb9e4ac5805d8018e50d5e6a7f0ab94c2aca6cf8d1072e8a2717f05d51a6b4",
  "tunnus-puu/long":
    "cca08e19becb4e4144b180479adcf3640e76558faba3e790be9b2670c93c887c",
  "pisara/short":
    "4e4d941b594fe4d17e594c8699e4a1bbc1dac8cfc9ac91277f2c3ddf16580434",
  "pisara/long":
    "1e14b28b03572b4c0eec5393797f7d8d047c99d029a72170605703b185dd43a7",
  "lasit/short":
    "77a247169baf97add5dfe67cd7c3b93b6e90b8ba50e18a0502c00af40d3885ee",
  "lasit/long":
    "80417b48c794e93879775e7b2cfdf6aadb5c000d4b7a3722ced95a2b706b3532",
  "tuulikello/short":
    "ad1e5b565e8b7d0102239bbf5bb1685f96fd5841296554e7d609556ebe65700f",
  "tuulikello/long":
    "605cfe87424777fd9f566b96c68f7bd403691e1ddd45cb58301836546facd0b8",
  "kuplat/short":
    "b21f24dbf015d248548a9311d1ae50b56e785a391c369f8e70d29ca4d062accd",
  "kuplat/long":
    "bf2db0a5187e96a3bbd6d56aa2dd82d79a0d8514d106662d4196c58245e87ce5",
  "kulho/short":
    "6b6921c7d68d5d318cbc040f240aa6bed5701641169400db7c0ca60a99e1a67a",
  "kulho/long":
    "ebcc9fe095fe314c51fee0796b71d20952f920c53c8345b49ead0a5684068271",
  "jaapuikot/short":
    "679526c6537cef0dc1a9c29908ab63fd16e01744304a26214f0ac4c4e8f78efb",
  "jaapuikot/long":
    "711a88ceb473193a020b71cff7266fe8bd2be0cbf94cf9b37866cf90d17f62cc",
};

function fingerprint({
  left,
  right,
}: {
  left: Float32Array;
  right: Float32Array;
}) {
  const pcm = new Int16Array(left.length * 2);
  const q = (x: number) =>
    Math.max(-32768, Math.min(32767, Math.round(x * 32767)));
  for (let i = 0; i < left.length; i++) {
    pcm[2 * i] = q(left[i]);
    pcm[2 * i + 1] = q(right[i]);
  }
  return createHash("sha256").update(Buffer.from(pcm.buffer)).digest("hex");
}

describe("attention sounds", () => {
  for (const id of soundIds)
    for (const length of ["short", "long"] as SoundLength[])
      it(`${id} ${length} is the accepted render`, () => {
        const sound = renderSound(id, length);
        expect(sound.left.length).toBe(
          Math.round(soundDuration(id, length) * SAMPLE_RATE),
        );
        expect(fingerprint(sound)).toBe(accepted[`${id}/${length}`]);
      });

  it("a short sound is shorter than its long one, and every strike is inside it", () => {
    for (const id of soundIds) {
      expect(soundDuration(id, "short")).toBeLessThan(
        soundDuration(id, "long"),
      );
      for (const length of ["short", "long"] as SoundLength[])
        for (const s of soundStrikes(id, length))
          expect(s.at).toBeLessThan(soundDuration(id, length));
    }
  });
});
