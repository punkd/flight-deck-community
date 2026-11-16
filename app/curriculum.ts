import { labWeeks } from "./content/labs";
import { extras } from "./content/extras";
import type { Language } from "./locale";

const moduleData = [
 [1, 1,10,120,30,90,"terminal","orange","Systems, networking and programming","Sistemas, redes y programación","Foundations","Fundamentos","Linux · Git · Python · Docker"],
 [2,11,13,60,15,45,"layers","blue","Databases and infrastructure as code","Bases de datos e infraestructura como código","Data & IaC","Datos e IaC","PostgreSQL · Terraform · Lambda"],
 [3,14,22,160,40,120,"cloud","purple","Cloud infrastructure and delivery pipelines","Infraestructura en la nube y pipelines","Cloud & CI/CD","Nube y CI/CD","AWS · Jenkins · GitHub Actions · Bedrock"],
 [4,23,25,120,35,85,"box","green","Machine learning and container orchestration","Aprendizaje automático y orquestación","Kubernetes & ML","Kubernetes y ML","Kubernetes · Docker · ML"],
 [5,26,28,100,30,70,"activity","rose","Configuration, monitoring and capstone","Configuración, monitoreo y proyecto final","Observability & Capstone","Observabilidad y proyecto final","Ansible · Prometheus · Grafana · DevSecOps"],
] as const;

export const resources = {
 linux:["Ubuntu · Linux shell tutorial","https://ubuntu.com/tutorials/command-line-for-beginners"],
 ssh:["Ubuntu · OpenSSH","https://documentation.ubuntu.com/server/how-to/security/openssh-server/"],
 git:["Pro Git","https://git-scm.com/book/en/v2"],
 python:["Python Tutorial","https://docs.python.org/3/tutorial/"],
 docker:["Docker · hands-on tutorial","https://docs.docker.com/get-started/tutorials/run-an-app/"],
 compose:["Docker Compose · quickstart","https://docs.docker.com/compose/gettingstarted/"],
 postgres:["PostgreSQL · tutorial","https://www.postgresql.org/docs/current/tutorial.html"],
 tf:["HashiCorp · Terraform on AWS","https://developer.hashicorp.com/terraform/tutorials/aws-get-started"],
 aws:["AWS · EC2 tutorials","https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-instance-launch-tutorials.html"],
 vpc:["AWS · VPC tutorials","https://docs.aws.amazon.com/vpc/latest/userguide/vpc-tutorials-intro.html"],
 iam:["AWS · IAM best practices","https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html"],
 lambda:["AWS · Lambda getting started","https://docs.aws.amazon.com/lambda/latest/dg/getting-started.html"],
 jenkins:["Jenkins · Pipeline","https://www.jenkins.io/doc/book/pipeline/"],
 actions:["GitHub Actions · quickstart","https://docs.github.com/en/actions/get-started/quickstart"],
 ecs:["AWS · ECS on Fargate","https://docs.aws.amazon.com/AmazonECS/latest/developerguide/getting-started-fargate.html"],
 trivy:["Trivy · documentation","https://trivy.dev/latest/"],
 bedrock:["Amazon Bedrock · quickstart","https://docs.aws.amazon.com/bedrock/latest/userguide/getting-started.html"],
 k8s:["Kubernetes Basics · hands-on","https://kubernetes.io/docs/tutorials/kubernetes-basics/"],
 ml:["scikit-learn · getting started","https://scikit-learn.org/stable/getting_started.html"],
 ansible:["Ansible · getting started","https://docs.ansible.com/ansible/latest/getting_started/index.html"],
 prom:["Prometheus · getting started","https://prometheus.io/docs/prometheus/latest/getting_started/"],
 grafana:["Grafana · getting started","https://grafana.com/docs/grafana/latest/getting-started/"],
 fastapi:["FastAPI · tutorial","https://fastapi.tiangolo.com/tutorial/"],
} as const;

type Resource = keyof typeof resources;
export type Task = {id:string; week:number; title:string; steps:readonly string[]; result:string; minutes:number; kind:string; day:number; resource:Resource};
const weekResources:Resource[]=["linux","linux","linux","ssh","git","linux","python","fastapi","docker","compose","postgres","tf","lambda","iam","vpc","actions","jenkins","ecs","trivy","bedrock","bedrock","tf","k8s","k8s","ml","ansible","prom","git"];

function makeCurriculum(language:Language) {
 const es=language==="es", position=es?1:0;
 const modules=moduleData.map(([id,from,to,hours,theory,practical,icon,color,en,spanish,shortEn,shortEs,tech])=>({id,from,to,hours,theory,practical,icon,color,name:es?spanish:en,short:es?shortEs:shortEn,tech}));
 const weeks=labWeeks.map(([en,spanish,rows], index) => ({
  number:index+1,title:es?spanish:en,resource:weekResources[index],
  module:modules.find(item=>index+1<=item.to)!.id,
  tasks:rows.map((pair,i):Task=>{
   const [title,steps,result]=pair[position];
   return {id:`w${index+1}-${i+1}`,week:index+1,title,steps,result,minutes:[120,150,150,180][i],kind:i===3?(es?"Entrega semanal":"Weekly deliverable"):(es?"Laboratorio":"Lab"),day:[0,2,4,index===27?5:6][i],resource:weekResources[index]};
  }),
 }));
 const prep:Task[]=extras.prep.map(([minutes,resource,en,spanish],i)=>{
  const [title,...details]=es?spanish:en;
  return {id:"prep-"+(i+1),week:0,title,steps:details.slice(0,-1),result:details.at(-1)!,minutes,kind:es?"Preparación":"Preparation",day:0,resource};
 });
 const skills=extras.skills.map(([id,icon,color,weeks,resource,en,spanish])=>{
  const [name,...items]=es?spanish:en;
  return {id,icon,color,weeks,resource,name,items};
 });
 const projects=extras.projects.map(([id,weeks,icon,color,en,spanish])=>{
  const [name,summary,...items]=es?spanish:en;
  return {id,weeks,icon,color,name,summary,items};
 });
 const career=extras.career.map(pair=>{
  const [name,...items]=pair[position];
  return {name,items};
 });
 return {modules,weeks,prep,tasks:[...prep,...weeks.flatMap(w=>w.tasks)],skills,projects,career};
}
const curricula={en:makeCurriculum("en"),es:makeCurriculum("es")};
export const getCurriculum=(language:Language)=>curricula[language];
export type PortfolioProject=ReturnType<typeof getCurriculum>["projects"][number];
