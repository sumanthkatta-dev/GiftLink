/** The gift box drawing. All of its looks and motion live in globals.css. */
export function GiftBoxArt({ withEffects = false }: { withEffects?: boolean }) {
  return (
    <>
      <span className="giftbox-glow" />
      <span className="giftbox-shadow" />
      {withEffects && <span className="giftbox-burst" />}
      <span className="giftbox-inner">
        {withEffects && <span className="giftbox-light" />}
        <span className="giftbox-body" />
        <span className="giftbox-lid">
          <span className="giftbox-lid-top" />
          <span className="giftbox-lid-front" />
          <span className="giftbox-bow">
            <i />
            <i />
            <b />
          </span>
        </span>
      </span>
    </>
  );
}
