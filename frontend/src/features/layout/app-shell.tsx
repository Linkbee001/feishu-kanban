import { Outlet } from 'react-router';
import {
  SidebarProvider,
  SidebarInset,
} from '@/components/ui/sidebar';
import { AppSidebar } from './sidebar';
import { Header } from './header';
import { AppBreadcrumb } from './breadcrumb';
import { ScrollArea } from '@/components/ui/scroll-area';

export function AppShell() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <Header />
        <main className="flex-1 overflow-hidden">
          <ScrollArea className="h-[calc(100vh-3.5rem)]">
            <div className="container mx-auto p-6">
              <AppBreadcrumb />
              <Outlet />
            </div>
          </ScrollArea>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
