import { getAllPrompts } from "@/lib/prompts";
import { NextResponse } from "next/server";

export async function GET() {
  const prompts = await getAllPrompts();
  return NextResponse.json({
    menuExtractionSystem: prompts.menuSystem.text,
    menuExtractionUser: prompts.menuUser.text,
    dishEnhancement: prompts.dishEnhancement.text,
    files: {
      menuExtractionSystem: prompts.menuSystem.sourceFile,
      menuExtractionUser: prompts.menuUser.sourceFile,
      dishEnhancement: prompts.dishEnhancement.sourceFile,
    },
  });
}