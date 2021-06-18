import "react-app-polyfill/ie11"; 
import "react-app-polyfill/stable";
import 'antd/dist/antd.css'; // or 'antd/dist/antd.less'
import "./Tab.scss";

import * as React from "react";
import * as SDK from "azure-devops-extension-sdk";
import { CommonServiceIds, IHostPageLayoutService } from "azure-devops-extension-api";
import { Page } from "azure-devops-ui/Page";

import { ReleaseInfo } from "../ReleaseInfo/ReleaseInfo";
import { showRootComponent } from "../Common";

interface ITabContentState {
    selectedTabId: string;
    fullScreenMode: boolean;
    headerDescription?: string;
    useLargeTitle?: boolean;
    useCompactPivots?: boolean;
}

class TabContent extends React.Component<{}, ITabContentState> {

    constructor(props: {}) {
        super(props);

        this.state = {
            selectedTabId: "releaseinfo",
            fullScreenMode: false
        };
    }

    public componentDidMount() {
        SDK.init();
        this.initializeFullScreenState();
    }

    public render(): JSX.Element {

        return (
            <Page className="sample-Tab flex-grow">
                { this.getPageContent() }
            </Page>
        );
    }

    private getPageContent() {
         return <ReleaseInfo />;
        
    }

    private async initializeFullScreenState() {
        const layoutService = await SDK.getService<IHostPageLayoutService>(CommonServiceIds.HostPageLayoutService);
        const fullScreenMode = await layoutService.getFullScreenMode();
        if (fullScreenMode !== this.state.fullScreenMode) {
            this.setState({ fullScreenMode });
        }
    }
}

showRootComponent(<TabContent />);