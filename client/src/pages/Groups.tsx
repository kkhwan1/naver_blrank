import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, FolderOpen, Edit, Trash2, Tag } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Group, Keyword } from '@shared/schema';

const groupFormSchema = z.object({
  name: z.string().min(1, '그룹 이름을 입력해주세요').max(50, '그룹 이름은 50자 이하로 입력해주세요'),
  description: z.string().max(200, '설명은 200자 이하로 입력해주세요').optional(),
  color: z.string().optional(),
});

type GroupFormData = z.infer<typeof groupFormSchema>;

const PRESET_COLORS = [
  { name: '빨강', value: '#ef4444' },
  { name: '주황', value: '#f97316' },
  { name: '노랑', value: '#eab308' },
  { name: '초록', value: '#22c55e' },
  { name: '파랑', value: '#3b82f6' },
  { name: '남색', value: '#6366f1' },
  { name: '보라', value: '#a855f7' },
  { name: '분홍', value: '#ec4899' },
];

export default function Groups() {
  const { toast } = useToast();
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<Group | null>(null);

  const { data: groups = [], isLoading: groupsLoading } = useQuery<Group[]>({
    queryKey: ['/api/groups'],
  });

  const { data: groupKeywords = [], isLoading: keywordsLoading } = useQuery<Keyword[]>({
    queryKey: ['/api/groups', selectedGroup?.id, 'keywords'],
    enabled: !!selectedGroup,
  });

  const createForm = useForm<GroupFormData>({
    resolver: zodResolver(groupFormSchema),
    defaultValues: {
      name: '',
      description: '',
      color: PRESET_COLORS[0].value,
    },
  });

  const editForm = useForm<GroupFormData>({
    resolver: zodResolver(groupFormSchema),
    defaultValues: {
      name: '',
      description: '',
      color: PRESET_COLORS[0].value,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: GroupFormData) => {
      return await apiRequest('POST', '/api/groups', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/groups'] });
      setIsCreateDialogOpen(false);
      createForm.reset();
      toast({
        title: '그룹이 생성되었습니다',
      });
    },
    onError: (error: Error) => {
      toast({
        title: '그룹 생성 실패',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: GroupFormData }) => {
      return await apiRequest('PUT', `/api/groups/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/groups'] });
      setIsEditDialogOpen(false);
      setSelectedGroup(null);
      toast({
        title: '그룹이 수정되었습니다',
      });
    },
    onError: (error: Error) => {
      toast({
        title: '그룹 수정 실패',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('DELETE', `/api/groups/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/groups'] });
      setIsDeleteDialogOpen(false);
      setGroupToDelete(null);
      if (selectedGroup?.id === groupToDelete?.id) {
        setSelectedGroup(null);
      }
      toast({
        title: '그룹이 삭제되었습니다',
      });
    },
    onError: (error: Error) => {
      toast({
        title: '그룹 삭제 실패',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleCreate = (data: GroupFormData) => {
    createMutation.mutate(data);
  };

  const handleEdit = (group: Group) => {
    setSelectedGroup(group);
    editForm.setValue('name', group.name);
    editForm.setValue('description', group.description || '');
    editForm.setValue('color', group.color || PRESET_COLORS[0].value);
    setIsEditDialogOpen(true);
  };

  const handleUpdate = (data: GroupFormData) => {
    if (selectedGroup) {
      updateMutation.mutate({ id: selectedGroup.id, data });
    }
  };

  const handleDelete = (group: Group) => {
    setGroupToDelete(group);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (groupToDelete) {
      deleteMutation.mutate(groupToDelete.id);
    }
  };

  return (
    <div className="h-full flex flex-col p-6 space-y-6 overflow-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">키워드 그룹 관리</h1>
          <p className="text-muted-foreground mt-1">
            키워드를 그룹으로 분류하고 관리하세요
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-group">
              <Plus className="w-4 h-4 mr-2" />
              새 그룹
            </Button>
          </DialogTrigger>
          <DialogContent data-testid="dialog-create-group">
            <DialogHeader>
              <DialogTitle>새 그룹 만들기</DialogTitle>
              <DialogDescription>
                키워드를 분류할 그룹을 만들어보세요
              </DialogDescription>
            </DialogHeader>
            <Form {...createForm}>
              <form onSubmit={createForm.handleSubmit(handleCreate)} className="space-y-4">
                <FormField
                  control={createForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>그룹 이름</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="예: 메인 키워드, 서브 키워드"
                          data-testid="input-group-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>설명 (선택)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="그룹에 대한 설명"
                          data-testid="input-group-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="color"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>색상</FormLabel>
                      <FormControl>
                        <div className="flex gap-2">
                          {PRESET_COLORS.map((color) => (
                            <button
                              key={color.value}
                              type="button"
                              onClick={() => field.onChange(color.value)}
                              className={`w-8 h-8 rounded-full border-2 transition-all ${
                                field.value === color.value
                                  ? 'border-primary scale-110'
                                  : 'border-border'
                              }`}
                              style={{ backgroundColor: color.value }}
                              data-testid={`color-${color.name}`}
                              title={color.name}
                            />
                          ))}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending}
                    data-testid="button-submit-create"
                  >
                    {createMutation.isPending ? '생성 중...' : '생성'}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
        {/* 그룹 목록 */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FolderOpen className="w-5 h-5" />
                그룹 목록
              </CardTitle>
              <CardDescription>
                총 {groups.length}개의 그룹
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {groupsLoading ? (
                <div className="text-sm text-muted-foreground text-center py-4">
                  로딩 중...
                </div>
              ) : groups.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-8">
                  그룹이 없습니다
                  <br />
                  새 그룹을 만들어보세요
                </div>
              ) : (
                groups.map((group) => (
                  <div
                    key={group.id}
                    className={`flex items-center justify-between p-3 rounded-md border cursor-pointer hover-elevate transition-all ${
                      selectedGroup?.id === group.id
                        ? 'bg-accent border-primary'
                        : 'bg-card'
                    }`}
                    onClick={() => setSelectedGroup(group)}
                    data-testid={`group-item-${group.id}`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div
                        className="w-4 h-4 rounded-full flex-shrink-0"
                        style={{ backgroundColor: group.color || PRESET_COLORS[0].value }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{group.name}</div>
                        {group.description && (
                          <div className="text-xs text-muted-foreground truncate">
                            {group.description}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(group);
                        }}
                        data-testid={`button-edit-group-${group.id}`}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(group);
                        }}
                        data-testid={`button-delete-group-${group.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* 그룹 상세 */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Tag className="w-5 h-5" />
                {selectedGroup ? `${selectedGroup.name} - 키워드 목록` : '그룹을 선택하세요'}
              </CardTitle>
              {selectedGroup && (
                <CardDescription>
                  총 {groupKeywords.length}개의 키워드
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              {!selectedGroup ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FolderOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>왼쪽에서 그룹을 선택하면</p>
                  <p>해당 그룹의 키워드를 볼 수 있습니다</p>
                </div>
              ) : keywordsLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  로딩 중...
                </div>
              ) : groupKeywords.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Tag className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>이 그룹에 키워드가 없습니다</p>
                  <p className="text-sm mt-2">대시보드에서 키워드를 그룹에 추가할 수 있습니다</p>
                </div>
              ) : (
                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>키워드</TableHead>
                        <TableHead>타겟 URL</TableHead>
                        <TableHead>측정 주기</TableHead>
                        <TableHead>상태</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {groupKeywords.map((keyword) => (
                        <TableRow key={keyword.id} data-testid={`keyword-row-${keyword.id}`}>
                          <TableCell className="font-medium">{keyword.keyword}</TableCell>
                          <TableCell className="max-w-xs truncate">
                            <a
                              href={keyword.targetUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline"
                            >
                              {keyword.targetUrl}
                            </a>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{keyword.measurementInterval || '24h'}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={keyword.isActive ? 'default' : 'secondary'}>
                              {keyword.isActive ? '활성' : '비활성'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 수정 다이얼로그 */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent data-testid="dialog-edit-group">
          <DialogHeader>
            <DialogTitle>그룹 수정</DialogTitle>
            <DialogDescription>
              그룹 정보를 수정하세요
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleUpdate)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>그룹 이름</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="예: 메인 키워드, 서브 키워드"
                        data-testid="input-edit-group-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>설명 (선택)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="그룹에 대한 설명"
                        data-testid="input-edit-group-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>색상</FormLabel>
                    <FormControl>
                      <div className="flex gap-2">
                        {PRESET_COLORS.map((color) => (
                          <button
                            key={color.value}
                            type="button"
                            onClick={() => field.onChange(color.value)}
                            className={`w-8 h-8 rounded-full border-2 transition-all ${
                              field.value === color.value
                                ? 'border-primary scale-110'
                                : 'border-border'
                            }`}
                            style={{ backgroundColor: color.value }}
                            data-testid={`edit-color-${color.name}`}
                            title={color.name}
                          />
                        ))}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="submit"
                  disabled={updateMutation.isPending}
                  data-testid="button-submit-edit"
                >
                  {updateMutation.isPending ? '수정 중...' : '수정'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* 삭제 확인 다이얼로그 */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent data-testid="dialog-delete-group">
          <DialogHeader>
            <DialogTitle>그룹 삭제</DialogTitle>
            <DialogDescription>
              정말로 "{groupToDelete?.name}" 그룹을 삭제하시겠습니까?
              <br />
              그룹에 속한 키워드는 삭제되지 않습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
              data-testid="button-cancel-delete"
            >
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? '삭제 중...' : '삭제'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
