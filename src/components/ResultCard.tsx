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
  const isCopied = !!copied[id];

  return (
    <Card className="bg-white/80 border border-gray-200 shadow-md rounded-2xl">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="text-lg text-gray-800">{title}</CardTitle>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onCopy(id, text)}
          aria-label={isCopied ? "Texte copié" : "Copier le texte"}
          className="gap-2"
        >
          {isCopied ? (
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
