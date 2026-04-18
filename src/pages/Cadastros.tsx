import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EspecialidadesTab } from "@/components/cadastros/EspecialidadesTab";
import { MedicosTab } from "@/components/cadastros/MedicosTab";

export default function Cadastros() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Cadastros</h1>
        <p className="text-sm text-muted-foreground">
          Gerencie especialidades, médicos e horários de atendimento. Esses dados são
          usados pelo bot da Sofia para oferecer agendamentos.
        </p>
      </div>

      <Tabs defaultValue="especialidades" className="space-y-4">
        <TabsList>
          <TabsTrigger value="especialidades">Especialidades</TabsTrigger>
          <TabsTrigger value="medicos">Médicos</TabsTrigger>
        </TabsList>
        <TabsContent value="especialidades">
          <EspecialidadesTab />
        </TabsContent>
        <TabsContent value="medicos">
          <MedicosTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
