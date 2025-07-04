import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clipboard, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  title: string;
  id: string;
  text: string;
  copied: { [key: string]: boolean };
  onCopy: (key: string, text: string) => void;
};

export default function ResultCard({ title, id, text, copied, onCopy }: Props) {
  return (
    <Card className="bg-white/80 border border-gray-200 shadow-md rounded-2xl">
      <CardHeader className="flex items-center justify-between">
        <CardTitle className="text-lg text-gray-800">{title}</CardTitle>
        <Button variant="ghost" size="icon" onClick={() => onCopy(id, text)}>
          {copied[id] ? (
            <>
              <Check className="w-4 h-4 text-green-600" />
              <span>Copié</span>
            </>
          ) : (
            <>
              <Clipboard className="w-4 h-4 text-gray-600" />
              <span>Copier</span>
            </>
          )}
        </Button>
      </CardHeader>
      <CardContent>
        <p className="whitespace-pre-line text-sm text-gray-700 leading-relaxed">
          {text}
        </p>
      </CardContent>
    </Card>
  );
}
