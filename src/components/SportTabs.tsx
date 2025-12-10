"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sport } from "@/lib/espn";

interface SportTabsProps {
  value: Sport;
  onChange: (sport: Sport) => void;
}

export function SportTabs({ value, onChange }: SportTabsProps) {
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as Sport)}>
      <TabsList className="grid w-full grid-cols-2 max-w-xs mx-auto">
        <TabsTrigger value="wbb">Women&apos;s BB</TabsTrigger>
        <TabsTrigger value="mbb">Men&apos;s BB</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
