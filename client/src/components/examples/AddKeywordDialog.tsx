import { useState } from 'react';
import AddKeywordDialog from '../AddKeywordDialog';
import { Button } from '@/components/ui/button';

export default function AddKeywordDialogExample() {
  const [open, setOpen] = useState(false);

  return (
    <div className="p-4">
      <Button onClick={() => setOpen(true)}>Open Dialog</Button>
      <AddKeywordDialog
        open={open}
        onOpenChange={setOpen}
        onSubmit={(data) => console.log('Submitted:', data)}
      />
    </div>
  );
}
