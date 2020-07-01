import * as React from "react";
import * as SDK from "azure-devops-extension-sdk";
import { CommonServiceIds, IProjectPageService, IHostNavigationService, getClient} from "azure-devops-extension-api";
import * as ReleaseAPI from "azure-devops-extension-api/Release";
import * as WorkItemAPI from "azure-devops-extension-api/WorkItemTracking";
import { Table } from 'antd';
import { Button } from "azure-devops-ui/Button";
import { ButtonGroup } from "azure-devops-ui/ButtonGroup";
import { ExportToCsv } from 'export-to-csv';

export interface IReleaseInfoState {
    expandable?: any;
    workItems?: ReleaseAPI.ReleaseWorkItemRef[];
    deploymentInfo?: string;
    releaseName?: string;
    columns?: any;
    dataSource?: IWorkItem[];
    iframeUrl?: string;
    message?: string;
    artifact?: string;
    workItemCsvArray?: IWorkItemCsv[];
}

interface IWorkItem{
    key: number;
    witid: any;
    title: string[];
    type: string;
    typeIcon: string;
    children?: any;
    ref?:string|undefined;
}

interface IWorkItemCsv{
    witid: any;
    artifact: string;
    title1: string;
    title2: string;
    title3: string;
    title4: string;
    title5: string;
    title6: string;
    type: string;
    ref?:string|undefined;
}

export class ReleaseInfo extends React.Component<{}, IReleaseInfoState> {

    constructor(props: {}) {
        super(props);

        this.state = {
            iframeUrl: window.location.href
        };
    }

    public componentDidMount() {
        this.initializeState();
    }

    private async initializeState(): Promise<void> {
        await SDK.ready();
        const projectService = await SDK.getService<IProjectPageService>(CommonServiceIds.ProjectPageService);
        const project = await projectService.getProject();
        const navService = await SDK.getService<IHostNavigationService>(CommonServiceIds.HostNavigationService);
        const hash = await navService.getQueryParams();
        
        const releaseId = +hash.releaseId;
        const environmentId = +hash.environmentId;
        if (project) {
            this.getDeploymentsAndReleases(project,releaseId,environmentId);
        }
    }

    public async getDeploymentsAndReleases(project:any,releaseId:number,environmentId:number){
        const workItemTypes = this.getWorkItemTypes(project.id);
        const releaseRestClient = getClient(ReleaseAPI.ReleaseRestClient);
        const releaseDetails = await releaseRestClient.getRelease(project.id, releaseId,7)
        const releaseEnvironment = await releaseRestClient.getReleaseEnvironment(project.id, releaseId, environmentId);
        const releaseDeployments = await releaseRestClient.getDeployments(project.id, releaseDetails.releaseDefinition.id, releaseEnvironment.definitionEnvironmentId, undefined, undefined, undefined, 30, 7960, true,0,100);
        const artifactsArray = (releaseDetails.artifacts);
        
        var releaseName = releaseDetails.name;
        var deploymentInfo  = releaseDetails.releaseDefinition.name + "_" + releaseId;
        this.setState({ deploymentInfo: deploymentInfo, releaseName: releaseName });
        
        if(releaseDeployments.length > 0) {
            const _this = this;
            var workItemDetails:any = [];
            var workItemTypesInfo:any = [];

            let resultsPerArtifact = artifactsArray.map(async (artifact) => {
                //Base deployment is the second deployment in Releasedeployments. The last succesfull deployment.
                const baseDeployment:ReleaseAPI.Deployment = releaseDeployments[releaseDeployments.findIndex(deployment => deployment.release.id === releaseId)+1];
                const baseRelease = (baseDeployment !== undefined) ? baseDeployment.release.id : undefined;
                const releaseWorkItems = await releaseRestClient.getReleaseWorkItemsRefs(project.id,releaseId,baseRelease,250,artifact.alias);
                //If the current deployment ID is smaller then the last succesfull deployment, the work items found will be rolled back.
                const workItemRefType = (releaseId < baseDeployment.release.id) ? "Rolled back" : "Updated"
                const workItemIds:number[] = releaseWorkItems.map(releaseWorkItem => +releaseWorkItem.id);
                if(workItemIds.length > 0){
                    var queryResult:WorkItemAPI.WorkItemQueryResult = await _this.getParentsByQuery(workItemIds);
                    const allWorkItems = queryResult.workItemRelations.map(relation => relation.target.id);
                    const allWorkItemDetails = _this.getWorkItemBatch(allWorkItems);
                    [workItemDetails, workItemTypesInfo] = await Promise.all([allWorkItemDetails,workItemTypes]);
                    
                    return [workItemDetails, workItemTypesInfo, queryResult,workItemIds,workItemRefType,artifact];
                } else {
                    return ["Nothing found", "Nothing found", "Nothing found", "Nothing found", "Nothing found", artifact];
                }
            });
            
            var resultsPerArtifactNew = await Promise.all(resultsPerArtifact);
            _this.createTableFromWorkItems(_this,resultsPerArtifactNew);
        }
        else {
            let message = "No earlier deployments found!";
            this.setState({ message: message})
        }
    }
    public createTableFromWorkItems(_this:this,resultsPerArtifact:any){
        var workItemArray: IWorkItem[] = [];
        var workItemCsvArray: IWorkItemCsv[] = [];
        for (var key = 0; key < resultsPerArtifact.length; key ++) {
            var artifact:ReleaseAPI.Artifact = resultsPerArtifact[key][5];
            var IWorkItem: IWorkItem  = {
                key: key,
                witid: artifact.alias,
                title: [artifact.definitionReference.artifactSourceVersionUrl.id,artifact.alias],
                type: "artifact",
                typeIcon: "https://tfsprodweu3.visualstudio.com/_apis/wit/workItemIcons/icon_gift?color=ff0066&v=2",
                ref: ""
            };
            var IWorkItemCsv: IWorkItemCsv  = {
                witid: artifact.alias,
                artifact: artifact.alias,
                title1: "",
                title2: "",
                title3: "",
                title4: "",
                title5: "",
                title6: "",
                type: "artifact",
                ref: ""
            };
            workItemArray.push(IWorkItem);
            workItemCsvArray.push(IWorkItemCsv);
            if(resultsPerArtifact[key][0] !== "Nothing found") {
                var allWorkItemDetails:WorkItemAPI.WorkItem[] = resultsPerArtifact[key][0];
                var queryResult:WorkItemAPI.WorkItemLink[] = resultsPerArtifact[key][2].workItemRelations;
                var releaseWorkItemRefs:number[] = resultsPerArtifact[key][3];
                var workItemRefType:string = resultsPerArtifact[key][4];
                var workItemTypes:WorkItemAPI.WorkItemType[] = resultsPerArtifact[key][1];
               
                queryResult.forEach(function (workItemLink) {
                    const workItem = allWorkItemDetails.filter(
                        workItem => workItem.id === workItemLink.target.id)[0];

                    const workItemType = workItemTypes.filter(
                        WIT => WIT.name === workItem.fields["System.WorkItemType"])[0];
                    
                    const ref = (releaseWorkItemRefs.indexOf(workItem.id) > -1) ? workItemRefType : "";
                    var IWorkItem: IWorkItem  = {
                        key: workItem.id,
                        witid: workItem.id,
                        title: [workItem._links.html.href,workItem.fields["System.Title"]],
                        type: workItem.fields["System.WorkItemType"],
                        typeIcon: workItemType.icon.url,
                        ref: ref
                    };
                    if(workItemLink.rel === "System.LinkTypes.Hierarchy-Forward"){
                        const parent = workItemLink.source.id;
                        if(_this.findParentAndAddChildWorkItems(workItemArray,parent,IWorkItem,workItemCsvArray) === undefined) {
                            let message = "Error when creating table, parent not found.";
                            _this.setState({ message: message})
                        }
                    }
                    else if(workItemLink.rel === null){
                        //No parent, add top level work item
                        const parent = artifact.alias;
                        _this.findParentAndAddChildWorkItems(workItemArray,parent,IWorkItem,workItemCsvArray)
                    }
                });
            }
            else{
                var IWorkItem: IWorkItem  = {
                    key: key,
                    witid: undefined,
                    title: [artifact.definitionReference.artifactSourceVersionUrl.id,"No Work Items changed for "+artifact.alias],
                    type: "",
                    typeIcon: "",
                    ref: ""
                };

                const parent = artifact.alias;
                _this.findParentAndAddChildWorkItems(workItemArray,parent,IWorkItem,workItemCsvArray)
            }
        }
        const columns = this.getColumns();

        const expandable = 
            {
                indentSize: 10,
                defaultExpandAllRows: true,
                expandRowByClick: true
            };
        this.setState({ dataSource: workItemArray, columns: columns, expandable: expandable, workItemCsvArray: workItemCsvArray});
    }

    public getColumns(){
        const columns = [
            {
                title: 'Title',
                dataIndex: 'title',
                key: 'title',
                render: (url:string[]) => <a href={url[0]} target="_Top" className="bolt-link">{url[1]}</a>,
            },
            {
                title: 'Type',
                dataIndex: 'typeIcon',
                colSpan: 1,
                align: 'left',
                render: (icon:string) => <img alt={icon} src={icon} width={25} />,
                key: 'typeIcon',
                width: 30,
            },
            {
                title: '',
                dataIndex: 'type',
                key: 'type',
            },
            {
                title: 'Id',
                dataIndex: 'witid',
                key: 'witid',
            },
            {
                title: 'Ref',
                dataIndex: 'ref',
                key: 'ref',
            },
        ];
        return columns;
    }
    public findParentAndAddChildWorkItems(workItemArray:IWorkItem[], parentWorkItem:any, IWorkItem:IWorkItem, workItemCsvArray:IWorkItemCsv[]): IWorkItem[] | undefined{
        const artifactCounter = (workItemArray.length > 0) ? workItemArray.length-1 : -1;
        const epicCounter = (artifactCounter > -1 && workItemArray[artifactCounter].children !== undefined) ? 
            workItemArray[artifactCounter].children.length-1 : -1;
        const featureCounter = (epicCounter > -1 && workItemArray[artifactCounter].children[epicCounter].children !== undefined) ? 
            workItemArray[artifactCounter].children[epicCounter].children.length-1 : -1;
        const pbiCounter = (featureCounter > -1 && workItemArray[artifactCounter].children[epicCounter].children[featureCounter].children !== undefined) ? 
            workItemArray[artifactCounter].children[epicCounter].children[featureCounter].children.length-1 : -1;
        const taskCounter = (pbiCounter > -1 && workItemArray[artifactCounter].children[epicCounter].children[featureCounter].children[pbiCounter].children !== undefined) ? 
            workItemArray[artifactCounter].children[epicCounter].children[featureCounter].children[pbiCounter].children.length-1 : -1;
        const lastCounter = (taskCounter > -1 && workItemArray[artifactCounter].children[epicCounter].children[featureCounter].children[pbiCounter].children[taskCounter].children !== undefined) ? 
            workItemArray[artifactCounter].children[epicCounter].children[featureCounter].children[pbiCounter].children[taskCounter].children.length-1 : -1;

        if(artifactCounter > -1 && workItemArray[artifactCounter].witid === parentWorkItem) {
            //Search the parent in the first level
            var IWorkItemCsv: IWorkItemCsv  = {
                witid: IWorkItem.witid,
                artifact: "",
                title1: IWorkItem.title[1],
                title2: "",
                title3: "",
                title4: "",
                title5: "",
                title6: "",
                type: IWorkItem.type,
                ref: IWorkItem.ref
            };
            workItemCsvArray.push(IWorkItemCsv);
            if(workItemArray[artifactCounter].children === undefined){
                //If the parent does not have children, create the first child
                workItemArray[artifactCounter].children = [IWorkItem];
            }
            else{
                //If the parent has children, add the work item to the children
                (workItemArray[artifactCounter].children).push(IWorkItem);
            }
            return workItemArray;
        }
        else if(epicCounter > -1 && workItemArray[artifactCounter].children[epicCounter].witid === parentWorkItem){
            //Search the parent in the second level
            var IWorkItemCsv: IWorkItemCsv  = {
                witid: IWorkItem.witid,
                artifact: "",
                title1: "",
                title2: IWorkItem.title[1],
                title3: "",
                title4: "",
                title5: "",
                title6: "",
                type: IWorkItem.type,
                ref: IWorkItem.ref
            };
            workItemCsvArray.push(IWorkItemCsv);
            if(workItemArray[artifactCounter].children[epicCounter].children === undefined){
                //If the parent does not have children, create the first child
                workItemArray[artifactCounter].children[epicCounter].children = [IWorkItem];
            }
            else{
                //If the parent has children, add the work item to the children
                (workItemArray[artifactCounter].children[epicCounter].children).push(IWorkItem);
            }
            return workItemArray;
        }
        else if(featureCounter > -1 && workItemArray[artifactCounter].children[epicCounter].children[featureCounter].witid === parentWorkItem){
            //Search the parent in the third level
            var IWorkItemCsv: IWorkItemCsv  = {
                witid: IWorkItem.witid,
                artifact: "",
                title1: "",
                title2: "",
                title3: IWorkItem.title[1],
                title4: "",
                title5: "",
                title6: "",
                type: IWorkItem.type,
                ref: IWorkItem.ref
            };
            workItemCsvArray.push(IWorkItemCsv);
            if(workItemArray[artifactCounter].children[epicCounter].children[featureCounter].children === undefined){
                //If the parent does not have children, create the first child
                workItemArray[artifactCounter].children[epicCounter].children[featureCounter].children = [IWorkItem];
            }
            else{
                //If the parent has children, add the work item to the children
                (workItemArray[artifactCounter].children[epicCounter].children[featureCounter].children).push(IWorkItem);
            }
            return workItemArray;
        }
        else if(pbiCounter > -1 && workItemArray[artifactCounter].children[epicCounter].children[featureCounter].children[pbiCounter].witid === parentWorkItem){
            //Search the parent in the third level
            var IWorkItemCsv: IWorkItemCsv  = {
                witid: IWorkItem.witid,
                artifact: "",
                title1: "",
                title2: "",
                title3: "",
                title4: IWorkItem.title[1],
                title5: "",
                title6: "",
                type: IWorkItem.type,
                ref: IWorkItem.ref
            };
            workItemCsvArray.push(IWorkItemCsv);
            if(workItemArray[artifactCounter].children[epicCounter].children[featureCounter].children[pbiCounter].children === undefined){
                //If the parent does not have children, create the first child
                workItemArray[artifactCounter].children[epicCounter].children[featureCounter].children[pbiCounter].children = [IWorkItem];
            }
            else{
                //If the parent has children, add the work item to the children
                (workItemArray[artifactCounter].children[epicCounter].children[featureCounter].children[pbiCounter].children).push(IWorkItem);
            }
            return workItemArray;
        }
        else if(taskCounter > -1 && workItemArray[artifactCounter].children[epicCounter].children[featureCounter].children[pbiCounter].children[taskCounter].witid === parentWorkItem){
            //Search the parent in the 4th level
            var IWorkItemCsv: IWorkItemCsv  = {
                witid: IWorkItem.witid,
                artifact: "",
                title1: "",
                title2: "",
                title3: "",
                title4: "",
                title5: IWorkItem.title[1],
                title6: "",
                type: IWorkItem.type,
                ref: IWorkItem.ref
            };
            workItemCsvArray.push(IWorkItemCsv);
            if(workItemArray[artifactCounter].children[epicCounter].children[featureCounter].children[pbiCounter].children[taskCounter].children === undefined){
                //If the parent does not have children, create the first child
                workItemArray[artifactCounter].children[epicCounter].children[featureCounter].children[pbiCounter].children[taskCounter].children = [IWorkItem];
            }
            else{
                //If the parent has children, add the work item to the children
                (workItemArray[artifactCounter].children[epicCounter].children[featureCounter].children[pbiCounter].children[taskCounter].children).push(IWorkItem);
            }
            return workItemArray;
        }
        else if(lastCounter > -1 && workItemArray[artifactCounter].children[epicCounter].children[featureCounter].children[pbiCounter].children[taskCounter].children[lastCounter].witid === parentWorkItem){
            //Search the parent in the 4th level
            var IWorkItemCsv: IWorkItemCsv  = {
                witid: IWorkItem.witid,
                artifact: "",
                title1: "",
                title2: "",
                title3: "",
                title4: "",
                title5: "",
                title6: IWorkItem.title[1],
                type: IWorkItem.type,
                ref: IWorkItem.ref
            };
            workItemCsvArray.push(IWorkItemCsv);
            if(workItemArray[artifactCounter].children[epicCounter].children[featureCounter].children[pbiCounter].children[taskCounter].children[lastCounter].children === undefined){
                //If the parent does not have children, create the first child
                workItemArray[artifactCounter].children[epicCounter].children[featureCounter].children[pbiCounter].children[taskCounter].children[lastCounter].children = [IWorkItem];
            }
            else{
                //If the parent has children, add the work item to the children
                (workItemArray[artifactCounter].children[epicCounter].children[featureCounter].children[pbiCounter].children[taskCounter].children[lastCounter].children).push(IWorkItem);
            }
            return workItemArray;
        }

        return undefined;
    }
    public async getParentsByQuery(witId: number[]): Promise<WorkItemAPI.WorkItemQueryResult>{
        const query:WorkItemAPI.Wiql = {
            query: "SELECT [System.Id],[System.WorkItemType],[System.Title],[System.AssignedTo],[System.State],[System.Tags] FROM WorkItemLinks WHERE ([Source].[System.WorkItemType] <> '' AND [Source].[System.State] <> '') AND ([System.Links.LinkType] = 'System.LinkTypes.Hierarchy-Forward') AND ([Target].[System.WorkItemType] <> '' AND [Target].[System.Id] IN (" + witId + ")) mode(Recursive, ReturnMatchingChildren)"
        }
        const workItemRestClient = getClient(WorkItemAPI.WorkItemTrackingRestClient);
        const queryResult = await workItemRestClient.queryByWiql(query);
        return queryResult;
    }

    public async getWorkItemBatch(ids: number[]): Promise<WorkItemAPI.WorkItem[]>{
        const workItemRestClient = getClient(WorkItemAPI.WorkItemTrackingRestClient);
        const body:WorkItemAPI.WorkItemBatchGetRequest = {
            $expand: 3,
            asOf: new Date,
            errorPolicy: 1,
            ids: ids,
            fields: ["System.Id","System.Title","System.WorkItemType"]
        }
        const workItems = await workItemRestClient.getWorkItemsBatch(body);
        return Promise.resolve(workItems);
    }
    
    public async getWorkItemTypes(project: string): Promise<WorkItemAPI.WorkItemType[]>{
        const workItemRestClient = getClient(WorkItemAPI.WorkItemTrackingRestClient);
        const workItemTypes = await workItemRestClient.getWorkItemTypes(project);
        return Promise.resolve(workItemTypes);
    }
    private exportToCsv = async (): Promise<void> => {
        const { workItemCsvArray, deploymentInfo, releaseName } = this.state;
        const options = { 
            fieldSeparator: ',',
            filename: deploymentInfo,
            quoteStrings: '"',
            decimalSeparator: '.',
            showLabels: true, 
            title: releaseName,
            showTitle: true,
            useTextFile: false,
            useBom: true,
            useKeysAsHeaders: true,
          };
         
        const csvExporter = new ExportToCsv(options);
        csvExporter.generateCsv(workItemCsvArray);
    }
    public render(): JSX.Element {

        const { message, dataSource, columns, expandable } = this.state;

        return (
                <div>
                    {
                        dataSource && <Table className="relative" pagination={false} dataSource={dataSource} columns={columns} expandable={expandable} size="small"  />
                    }
                    {
                        message && <div>{message}</div>
                    }
                    <br />
                    {
                        dataSource &&
                        <ButtonGroup>
                            <Button onClick={this.exportToCsv} text="Export to Csv" />
                        </ButtonGroup>
                    }
            </div>
        );
        
    }
}