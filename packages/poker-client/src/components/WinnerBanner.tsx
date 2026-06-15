import React, { useEffect } from "react";
import { useTableStore } from "../store/useTableStore.ts";

export const WinnerBanner: React.FC = () => {
  const { handResult, setHandResult } = useTableStore();

  useEffect(() => {
    if (!handResult) return;
    const capturedKey = handResult.resultKey;
    const id = setTimeout(() => {
      // Only clear if the same result is still displayed
      if (useTableStore.getState().handResult?.resultKey === capturedKey) {
        setHandResult(null);
      }
    }, 4000);
    return () => clearTimeout(id);
  }, [handResult?.resultKey, setHandResult]);

  if (!handResult || handResult.winners.length === 0) return null;

  const { winners } = handResult;
  const isSplit = winners.length > 1;
  const firstWinner = winners[0]!;
  const isFoldWin = firstWinner.isFoldWin;
  const totalPot = firstWinner.totalPot;

  return (
    <div className="winner-banner-container pointer-events-auto">
      <div className={`winner-banner-card ${isSplit ? 'split' : 'solo'}`}>
        <div className="winner-banner-header">
          <span className="winner-banner-icon">{isSplit ? "⚖️" : "🏆"}</span>
          <h4 className="winner-banner-title">
            {isSplit ? (
              <>
                <span className="text-amber-400">
                  {winners.map(w => w.playerName).join(" & ")}
                </span>{" "}
                split the pot!
              </>
            ) : (
              <>
                <span className="text-amber-400">{firstWinner.playerName}</span> wins!
              </>
            )}
          </h4>
        </div>

        <div className="winner-banner-details">
          {!isFoldWin && (
            <span className="winner-banner-badge">
              {firstWinner.handRankLabel}
            </span>
          )}
          <span className="winner-banner-pot">
            ${totalPot}
          </span>
        </div>
      </div>
    </div>
  );
};
