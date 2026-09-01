import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt =
  "Spotify Release Date sorter — sort playlists by release date";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const geistBold = await readFile(
  join(process.cwd(), "src/app/fonts/geist-sans-700.woff"),
);
const geistMedium = await readFile(
  join(process.cwd(), "src/app/fonts/geist-sans-500.woff"),
);

export default function Image() {
  return new ImageResponse(
    (
      <div tw="relative flex h-full w-full overflow-hidden bg-[#111412] text-[#FAFAFA]">
        <div tw="absolute top-[-180px] right-[-120px] h-[560px] w-[560px] rounded-full bg-[rgba(29,185,84,0.22)]" />
        <div tw="absolute bottom-[-140px] left-[-80px] h-[320px] w-[320px] rounded-full bg-[rgba(29,185,84,0.12)]" />
        <div tw="flex h-full w-full flex-col justify-center px-[72px]">
          <div tw="flex text-[64px] font-bold leading-[1.05] tracking-[-1.6px]">
            Spotify Release Date sorter
          </div>
          <div tw="mt-4 flex text-[30px] font-medium text-[#B8BDB9]">
            Put any playlist in chronological order.
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Geist", data: geistBold, weight: 700, style: "normal" },
        { name: "Geist", data: geistMedium, weight: 500, style: "normal" },
      ],
    },
  );
}
