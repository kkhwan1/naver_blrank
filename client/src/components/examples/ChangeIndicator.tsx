import ChangeIndicator from '../ChangeIndicator';

export default function ChangeIndicatorExample() {
  return (
    <div className="flex flex-col gap-3 p-4">
      <ChangeIndicator change={2} />
      <ChangeIndicator change={-1} />
      <ChangeIndicator change={0} />
      <div className="border-t pt-3 mt-2">
        <p className="text-sm text-muted-foreground mb-2">Without arrows:</p>
        <div className="flex gap-3">
          <ChangeIndicator change={2} showArrow={false} />
          <ChangeIndicator change={-1} showArrow={false} />
        </div>
      </div>
    </div>
  );
}
